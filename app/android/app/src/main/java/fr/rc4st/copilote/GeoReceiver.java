package fr.rc4st.copilote;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Nestor — le téléphone entre dans une zone surveillée (arrêt de bus, relais colis, lieu habituel) :
 * on affiche la notification préparée par l'appli.
 * Seule exception, déléguée par lui : les zones « chauffage » autour de la maison (il s'éloigne → absent,
 * il rentre → planning) envoient l'ordre à sa fonction serveur, puis préviennent avec de quoi annuler.
 */
public class GeoReceiver extends BroadcastReceiver {

    static final String CHANNEL = "lieux";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        GeofencingEvent ev = GeofencingEvent.fromIntent(intent);
        if (ev == null || ev.hasError()) return;
        int tr = ev.getGeofenceTransition();
        if (tr != Geofence.GEOFENCE_TRANSITION_ENTER && tr != Geofence.GEOFENCE_TRANSITION_EXIT) return;
        List<Geofence> hits = ev.getTriggeringGeofences();
        if (hits == null || hits.isEmpty()) return;
        SharedPreferences p = ctx.getSharedPreferences(TempoNativePlugin.PREFS, Context.MODE_PRIVATE);
        JSONArray fences;
        try {
            fences = new JSONArray(p.getString("geo_fences", "[]"));
        } catch (Exception e) {
            return;
        }
        long now = System.currentTimeMillis();
        for (Geofence g : hits) {
            String id = g.getRequestId();
            JSONObject f = null;
            for (int i = 0; i < fences.length(); i++) {
                JSONObject o = fences.optJSONObject(i);
                if (o != null && id.equals(o.optString("id"))) { f = o; break; }
            }
            if (f == null) continue;
            if (f.optBoolean("exit", false) != (tr == Geofence.GEOFENCE_TRANSITION_EXIT)) continue;
            if (f.has("hook")) { hook(ctx, p, id, f); continue; }
            long until = f.optLong("until", 0);
            if (until > 0 && until < now) continue;
            // pas deux fois la même alerte en 45 min (on passe souvent plusieurs fois devant)
            long last = p.getLong("geo_last_" + id, 0);
            if (now - last < 45 * 60 * 1000L) continue;
            String title = f.optString("title", "Nestor");
            String body = f.optString("body", "");
            long dep = f.optLong("dep", 0);
            if (dep > 0) {
                long min = Math.round((dep - now) / 60000.0);
                if (min < -1) continue;                       // le bus est déjà passé
                body = body.replace("{min}", String.valueOf(Math.max(0, min)));
            }
            p.edit().putLong("geo_last_" + id, now).apply();
            show(ctx, id, title, body, f.optString("url", "./"));
        }
    }

    /** zone chauffage : un seul ordre par changement (rien si le dernier ordre était déjà le même), en tâche de fond */
    private void hook(Context ctx, SharedPreferences p, String id, JSONObject f) {
        JSONObject h = f.optJSONObject("hook");
        if (h == null) return;
        JSONObject body = h.optJSONObject("body");
        if (body == null) return;
        final String mode = body.optString("mode", "");
        long now = System.currentTimeMillis();
        if (mode.isEmpty() || mode.equals(p.getString("chauffe_etat", ""))) return;
        if (now - p.getLong("chauffe_t", 0) < 3 * 60 * 1000L) return;   // pas d'aller-retour en rafale
        p.edit().putString("chauffe_etat", mode).putLong("chauffe_t", now).apply();
        final PendingResult pr = goAsync();
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            boolean ok = false;
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(h.optString("url")).openConnection();
                c.setRequestMethod("POST");
                c.setConnectTimeout(7000);
                c.setReadTimeout(7000);
                c.setDoOutput(true);
                c.setRequestProperty("content-type", "application/json");
                c.setRequestProperty("Authorization", "Bearer " + h.optString("key"));
                c.setRequestProperty("apikey", h.optString("key"));
                try (OutputStream o = c.getOutputStream()) { o.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
                ok = c.getResponseCode() == 200;
            } catch (Exception ignored) {
                // pas de réseau : on le dira dans la notification
            } finally {
                if (c != null) c.disconnect();
            }
            if (ok) show(app, id, f.optString("title", "Nestor"), f.optString("body", ""), f.optString("url", "./"));
            else {
                p.edit().remove("chauffe_etat").apply();   // on retentera au prochain passage
                show(app, id, "Chauffage : Netatmo n'a pas répondu", "away".equals(mode) ? "Tu t'es éloigné de la maison, mais le chauffage n'a pas pu passer en absent." : "Tu rentres, mais le chauffage n'a pas pu reprendre son planning.", "./");
            }
            if (pr != null) pr.finish();
        }).start();
    }

    static void show(Context ctx, String id, String title, String body, String url) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Alertes de lieu", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Quand tu arrives à ton arrêt, à un relais colis ou à un lieu où tu as quelque chose à faire");
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("copilote://ouvrir?u=" + Uri.encode(url)));
        open.setPackage(ctx.getPackageName());
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_tempo)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(pi);
        try {
            NotificationManagerCompat.from(ctx).notify(id.hashCode(), b.build());
        } catch (SecurityException e) {
            // notifications refusées : rien à faire
        }
    }
}
