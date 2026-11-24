package fr.rc4st.copilote;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.AlarmClock;
import android.provider.CalendarContract;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Tout ce que Tempo (la page web) ne peut pas faire seul dans une appli Android :
 * boîte d'entrée des notifications, voix (reconnaissance + synthèse), réveils et minuteurs,
 * widget, contacts du téléphone, partage, PDF, agenda, liens externes, mise à jour de l'intérieur.
 */
@CapacitorPlugin(
    name = "TempoNative",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "mic"),
        @Permission(strings = { Manifest.permission.READ_CONTACTS }, alias = "contacts"),
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, alias = "loc")
    }
)
public class TempoNativePlugin extends Plugin {

    static final String PREFS = "tempo_native";
    static final int NATIVE_BUILD = 9;

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private final List<Runnable> ttsWaiting = new ArrayList<>();
    private final Map<String, PluginCall> speakCalls = new HashMap<>();
    private SpeechRecognizer sr;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ------------------------------------------------------------------ démarrage

    @Override
    public void load() {
        // une mise à jour de l'intérieur qui n'a jamais confirmé son démarrage : on revient à la version embarquée
        SharedPreferences p = prefs();
        if (p.getBoolean("web_pending", false)) {
            p.edit().putBoolean("web_pending", false).putString("web_version", "").apply();
            getContext()
                .getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE)
                .edit()
                .putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, "")
                .apply();
        }
        handleShare(getActivity() != null ? getActivity().getIntent() : null);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handleShare(intent);
    }

    /** « Partager → Tempo » depuis n'importe quelle appli */
    private void handleShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (text == null && subject == null) return;
        JSObject d = new JSObject();
        d.put("text", ((subject != null && !subject.isEmpty()) ? subject + " — " : "") + (text != null ? text : ""));
        intent.setAction("fr.rc4st.copilote.SHARE_DONE");
        notifyListeners("shared", d, true);
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        r.put("native", NATIVE_BUILD);
        r.put("web", prefs().getString("web_version", ""));
        try {
            PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            r.put("versionName", pi.versionName);
        } catch (Exception ignored) {}
        r.put("notifAccess", notifAccessOk());
        r.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    // ------------------------------------------------------------------ boîte d'entrée (notifications)

    static synchronized void inboxAdd(Context c, JSONObject ev) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray a;
        try {
            a = new JSONArray(p.getString("inbox", "[]"));
        } catch (JSONException e) {
            a = new JSONArray();
        }
        a.put(ev);
        JSONArray b = new JSONArray();
        for (int i = Math.max(0, a.length() - 200); i < a.length(); i++) b.put(a.opt(i));
        p.edit().putString("inbox", b.toString()).apply();
    }

    static synchronized String inboxTake(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String s = p.getString("inbox", "[]");
        p.edit().putString("inbox", "[]").apply();
        return s;
    }

    @PluginMethod
    public void getInbox(PluginCall call) {
        JSObject r = new JSObject();
        try {
            r.put("events", new JSArray(inboxTake(getContext())));
        } catch (JSONException e) {
            r.put("events", new JSArray());
        }
        r.put("notifAccess", notifAccessOk());
        call.resolve(r);
    }

    private boolean notifAccessOk() {
        return NotificationManagerCompat.getEnabledListenerPackages(getContext()).contains(getContext().getPackageName());
    }

    @PluginMethod
    public void openNotifAccess(PluginCall call) {
        startSafely(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS), call);
    }

    /** applis dont Tempo lit les notifications, en plus de Téléphone / Messages / WhatsApp (choisies dans Tempo) */
    @PluginMethod
    public void setWatch(PluginCall call) {
        JSArray a = call.getArray("pkgs");
        Set<String> set = new HashSet<>();
        if (a != null) for (int i = 0; i < a.length(); i++) { String p = a.optString(i, ""); if (!p.isEmpty()) set.add(p); }
        prefs().edit().putStringSet("watch", set).apply();
        call.resolve();
    }

    /** les applis installées (nom + paquet) et celles qui ont envoyé des notifications récemment — jamais leur contenu */
    @PluginMethod
    public void getApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Set<String> watch = prefs().getStringSet("watch", new HashSet<>());
        JSONObject seen;
        try { seen = new JSONObject(prefs().getString("seen", "{}")); } catch (JSONException e) { seen = new JSONObject(); }
        Map<String, JSObject> out = new LinkedHashMap<>();
        try {
            Intent q = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            for (ResolveInfo ri : pm.queryIntentActivities(q, 0)) {
                String pkg = ri.activityInfo.packageName;
                if (pkg == null || out.containsKey(pkg) || pkg.equals(getContext().getPackageName())) continue;
                JSObject o = new JSObject();
                o.put("pkg", pkg);
                o.put("label", String.valueOf(ri.loadLabel(pm)));
                out.put(pkg, o);
            }
        } catch (Exception ignored) {}
        for (Iterator<String> it = seen.keys(); it.hasNext(); ) {
            String pkg = it.next();
            if (out.containsKey(pkg)) continue;
            JSObject o = new JSObject();
            o.put("pkg", pkg);
            String lab = pkg;
            try { lab = pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString(); } catch (Exception ignored) {}
            o.put("label", lab);
            out.put(pkg, o);
        }
        JSArray arr = new JSArray();
        for (JSObject o : out.values()) {
            String pkg = o.getString("pkg");
            o.put("seen", seen.optLong(pkg, 0));
            o.put("watched", watch.contains(pkg));
            arr.put(o);
        }
        JSObject r = new JSObject();
        r.put("apps", arr);
        call.resolve(r);
    }

    /** ouvre une appli (Snapchat pour répondre, Vinted pour le QR code du colis…) */
    @PluginMethod
    public void openApp(PluginCall call) {
        String pkg = call.getString("pkg", "");
        Intent i = pkg.isEmpty() ? null : getContext().getPackageManager().getLaunchIntentForPackage(pkg);
        if (i == null) { call.reject("no_app"); return; }
        startSafely(i, call);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        startSafely(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())), call);
    }

    // ------------------------------------------------------------------ position et alertes de lieu (Jarvis)

    private boolean bgGranted() {
        if (Build.VERSION.SDK_INT < 29) return getPermissionState("loc") == PermissionState.GRANTED;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject locJs() {
        JSObject r = new JSObject();
        boolean fine = getPermissionState("loc") == PermissionState.GRANTED;
        r.put("fine", fine);
        r.put("bg", fine && bgGranted());
        return r;
    }

    @PluginMethod
    public void locState(PluginCall call) {
        call.resolve(locJs());
    }

    @PluginMethod
    public void locAsk(PluginCall call) {
        if (getPermissionState("loc") != PermissionState.GRANTED) {
            requestPermissionForAlias("loc", call, "locPerm");
            return;
        }
        if (!bgGranted()) openLocSettings();
        call.resolve(locJs());
    }

    @PermissionCallback
    private void locPerm(PluginCall call) {
        if (getPermissionState("loc") == PermissionState.GRANTED && !bgGranted()) openLocSettings();
        call.resolve(locJs());
    }

    /** Android ne propose « Toujours autoriser » que depuis les réglages de l'appli. */
    private void openLocSettings() {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            // rien
        }
    }

    @PluginMethod
    public void position(PluginCall call) {
        if (getPermissionState("loc") != PermissionState.GRANTED) {
            call.reject("perm");
            return;
        }
        final FusedLocationProviderClient c = LocationServices.getFusedLocationProviderClient(getContext());
        try {
            c.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
                .addOnSuccessListener(loc -> {
                    if (loc != null) {
                        call.resolve(posJs(loc));
                        return;
                    }
                    try {
                        c.getLastLocation()
                            .addOnSuccessListener(l2 -> {
                                if (l2 != null) call.resolve(posJs(l2));
                                else call.reject("none");
                            })
                            .addOnFailureListener(e -> call.reject("none"));
                    } catch (SecurityException e) {
                        call.reject("perm");
                    }
                })
                .addOnFailureListener(e -> call.reject("none"));
        } catch (SecurityException e) {
            call.reject("perm");
        }
    }

    private JSObject posJs(android.location.Location l) {
        JSObject r = new JSObject();
        r.put("lat", l.getLatitude());
        r.put("lon", l.getLongitude());
        r.put("acc", l.getAccuracy());
        r.put("at", l.getTime());
        return r;
    }

    private PendingIntent geoIntent() {
        Intent i = new Intent(getContext(), GeoReceiver.class);
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        return PendingIntent.getBroadcast(getContext(), 7301, i, fl);
    }

    /** Zones surveillées : [{id, lat, lon, r, until, dep, title, body, url}] — remplace les précédentes. */
    @PluginMethod
    public void geoSet(PluginCall call) {
        JSArray fences = call.getArray("fences");
        if (fences == null) fences = new JSArray();
        prefs().edit().putString("geo_fences", fences.toString()).apply();
        final GeofencingClient gc = LocationServices.getGeofencingClient(getContext());
        final PendingIntent pi = geoIntent();
        if (getPermissionState("loc") != PermissionState.GRANTED || !bgGranted()) {
            gc.removeGeofences(pi);
            JSObject r = new JSObject();
            r.put("ok", false);
            r.put("why", "perm");
            call.resolve(r);
            return;
        }
        final List<Geofence> list = new ArrayList<>();
        long now = System.currentTimeMillis();
        for (int i = 0; i < fences.length() && list.size() < 90; i++) {
            JSONObject f = fences.optJSONObject(i);
            if (f == null || !f.has("lat") || !f.has("lon")) continue;
            long until = f.optLong("until", 0);
            if (until > 0 && until <= now) continue;
            float rad = (float) Math.max(100, Math.min(1000, f.optDouble("r", 200)));
            list.add(
                new Geofence.Builder()
                    .setRequestId(f.optString("id", "f" + i))
                    .setCircularRegion(f.optDouble("lat"), f.optDouble("lon"), rad)
                    .setExpirationDuration(until > 0 ? until - now : Geofence.NEVER_EXPIRE)
                    .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER)
                    .build()
            );
        }
        final int n = list.size();
        gc.removeGeofences(pi).addOnCompleteListener(t -> {
            JSObject r = new JSObject();
            if (n == 0) {
                r.put("ok", true);
                r.put("n", 0);
                call.resolve(r);
                return;
            }
            GeofencingRequest req = new GeofencingRequest.Builder().setInitialTrigger(0).addGeofences(list).build();
            try {
                gc.addGeofences(req, pi)
                    .addOnSuccessListener(v -> {
                        r.put("ok", true);
                        r.put("n", n);
                        call.resolve(r);
                    })
                    .addOnFailureListener(e -> {
                        r.put("ok", false);
                        r.put("why", String.valueOf(e.getMessage()));
                        call.resolve(r);
                    });
            } catch (SecurityException e) {
                r.put("ok", false);
                r.put("why", "perm");
                call.resolve(r);
            }
        });
    }

    // ------------------------------------------------------------------ synthèse vocale

    /* le moteur de synthèse vocale démarre une fois ; les demandes arrivées pendant le démarrage attendent */
    private void ttsInit(Runnable then) {
        synchronized (ttsWaiting) {
            if (tts != null && ttsReady) { then.run(); return; }
            ttsWaiting.add(then);
            if (tts != null) return;
            tts = new TextToSpeech(getContext().getApplicationContext(), status -> {
                ttsReady = status == TextToSpeech.SUCCESS;
                if (ttsReady) {
                    tts.setLanguage(Locale.FRANCE);
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override
                        public void onStart(String id) {}

                        @Override
                        public void onDone(String id) {
                            PluginCall c = speakCalls.remove(id);
                            if (c != null) c.resolve();
                        }

                        @Override
                        public void onError(String id) {
                            PluginCall c = speakCalls.remove(id);
                            if (c != null) c.resolve();
                        }
                    });
                }
                List<Runnable> w;
                synchronized (ttsWaiting) { w = new ArrayList<>(ttsWaiting); ttsWaiting.clear(); }
                for (Runnable r : w) r.run();
            });
        }
    }

    @PluginMethod
    public void speak(PluginCall call) {
        ttsInit(() -> {
            if (ttsReady) doSpeak(call);
            else call.reject("tts_indisponible");
        });
    }

    /* les voix françaises du téléphone, pour choisir celle de l'assistant */
    @PluginMethod
    public void voices(PluginCall call) {
        ttsInit(() -> {
            JSObject r = new JSObject();
            JSArray arr = new JSArray();
            if (ttsReady) {
                try {
                    Set<Voice> vs = tts.getVoices();
                    if (vs != null) for (Voice v : vs) {
                        Locale l = v.getLocale();
                        if (l == null || !"fr".equals(l.getLanguage())) continue;
                        JSObject o = new JSObject();
                        o.put("name", v.getName());
                        o.put("locale", l.toString());
                        o.put("quality", v.getQuality());
                        o.put("network", v.isNetworkConnectionRequired());
                        Set<String> f = v.getFeatures();
                        o.put("notInstalled", f != null && f.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED));
                        arr.put(o);
                    }
                } catch (Exception e) {}
            }
            r.put("ready", ttsReady);
            r.put("voices", arr);
            call.resolve(r);
        });
    }

    private void doSpeak(PluginCall call) {
        String text = call.getString("text", "");
        Float rate = call.getFloat("rate", 1.05f);
        Float pitch = call.getFloat("pitch", 1.0f);
        String vn = call.getString("voice", "");
        tts.setSpeechRate(rate != null ? rate : 1.05f);
        tts.setPitch(pitch != null ? pitch : 1.0f);
        boolean set = false;
        if (vn != null && !vn.isEmpty()) {
            try {
                Set<Voice> vs = tts.getVoices();
                if (vs != null) for (Voice v : vs) if (vn.equals(v.getName())) { set = tts.setVoice(v) == TextToSpeech.SUCCESS; break; }
            } catch (Exception e) {}
        }
        if (!set) tts.setLanguage(Locale.FRANCE);
        String id = UUID.randomUUID().toString();
        speakCalls.put(id, call);
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id);
    }

    /* mode discret automatique : silencieux, vibreur ou « ne pas déranger », sauf casque ou Bluetooth */
    @PluginMethod
    public void sonState(PluginCall call) {
        JSObject r = new JSObject();
        int ringer = 2;
        boolean dnd = false, casque = false;
        try {
            android.media.AudioManager am = (android.media.AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                ringer = am.getRingerMode();
                android.media.AudioDeviceInfo[] outs = am.getDevices(android.media.AudioManager.GET_DEVICES_OUTPUTS);
                if (outs != null) for (android.media.AudioDeviceInfo d : outs) {
                    int t = d.getType();
                    if (t == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || t == android.media.AudioDeviceInfo.TYPE_WIRED_HEADSET
                        || t == android.media.AudioDeviceInfo.TYPE_WIRED_HEADPHONES || t == android.media.AudioDeviceInfo.TYPE_USB_HEADSET) casque = true;
                }
            }
        } catch (Exception e) {}
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) dnd = nm.getCurrentInterruptionFilter() > android.app.NotificationManager.INTERRUPTION_FILTER_ALL;
        } catch (Exception e) {}
        r.put("ringer", ringer);
        r.put("dnd", dnd);
        r.put("casque", casque);
        call.resolve(r);
    }

    @PluginMethod
    public void stopSpeak(PluginCall call) {
        if (tts != null) tts.stop();
        for (PluginCall c : speakCalls.values()) c.resolve();
        speakCalls.clear();
        call.resolve();
    }

    // ------------------------------------------------------------------ reconnaissance vocale (Google, gratuite)

    @PluginMethod
    public void srStart(PluginCall call) {
        if (getPermissionState("mic") != PermissionState.GRANTED) {
            requestPermissionForAlias("mic", call, "micPerm");
            return;
        }
        startSr(call);
    }

    @PermissionCallback
    private void micPerm(PluginCall call) {
        if (getPermissionState("mic") == PermissionState.GRANTED) startSr(call);
        else call.reject("not-allowed");
    }

    private void emitSr(String type, String text, int code) {
        JSObject d = new JSObject();
        d.put("type", type);
        if (text != null) d.put("text", text);
        if (code != 0) d.put("code", code);
        notifyListeners("sr", d);
    }

    private void startSr(PluginCall call) {
        final String lang = call.getString("lang", "fr-FR");
        getActivity().runOnUiThread(() -> {
            try {
                if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                    call.reject("unavailable");
                    return;
                }
                if (sr != null) sr.destroy();
                sr = SpeechRecognizer.createSpeechRecognizer(getContext());
                sr.setRecognitionListener(new RecognitionListener() {
                    @Override
                    public void onReadyForSpeech(Bundle b) {}

                    @Override
                    public void onBeginningOfSpeech() {}

                    @Override
                    public void onRmsChanged(float rms) {}

                    @Override
                    public void onBufferReceived(byte[] buf) {}

                    @Override
                    public void onEndOfSpeech() {}

                    @Override
                    public void onError(int error) {
                        if (error != SpeechRecognizer.ERROR_NO_MATCH && error != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) emitSr("error", null, error);
                        emitSr("end", null, 0);
                    }

                    @Override
                    public void onResults(Bundle b) {
                        ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (l != null && !l.isEmpty()) emitSr("final", l.get(0), 0);
                        emitSr("end", null, 0);
                    }

                    @Override
                    public void onPartialResults(Bundle b) {
                        ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (l != null && !l.isEmpty()) emitSr("partial", l.get(0), 0);
                    }

                    @Override
                    public void onEvent(int t, Bundle b) {}
                });
                Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
                i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
                i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3500L);
                i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3500L);
                sr.startListening(i);
                call.resolve();
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        });
    }

    @PluginMethod
    public void srStop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (sr != null) sr.stopListening();
            } catch (Exception ignored) {}
            call.resolve();
        });
    }

    @PluginMethod
    public void srCancel(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (sr != null) {
                    sr.cancel();
                    sr.destroy();
                    sr = null;
                }
            } catch (Exception ignored) {}
            call.resolve();
        });
    }

    // ------------------------------------------------------------------ réveils et minuteurs (appli Horloge)

    @PluginMethod
    public void setAlarm(PluginCall call) {
        Intent i = new Intent(AlarmClock.ACTION_SET_ALARM);
        i.putExtra(AlarmClock.EXTRA_HOUR, (int) call.getInt("hour", 7));
        i.putExtra(AlarmClock.EXTRA_MINUTES, (int) call.getInt("minute", 0));
        i.putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("label", "Nestor"));
        i.putExtra(AlarmClock.EXTRA_SKIP_UI, (boolean) call.getBoolean("skipUi", true));
        JSArray days = call.getArray("days");
        if (days != null && days.length() > 0) {
            ArrayList<Integer> d = new ArrayList<>();
            for (int k = 0; k < days.length(); k++) d.add(days.optInt(k));
            i.putIntegerArrayListExtra(AlarmClock.EXTRA_DAYS, d);
        }
        startSafely(i, call);
    }

    @PluginMethod
    public void setTimer(PluginCall call) {
        Intent i = new Intent(AlarmClock.ACTION_SET_TIMER);
        i.putExtra(AlarmClock.EXTRA_LENGTH, (int) call.getInt("seconds", 300));
        i.putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("label", "Nestor"));
        i.putExtra(AlarmClock.EXTRA_SKIP_UI, true);
        startSafely(i, call);
    }

    @PluginMethod
    public void showAlarms(PluginCall call) {
        startSafely(new Intent(AlarmClock.ACTION_SHOW_ALARMS), call);
    }

    // ------------------------------------------------------------------ widget

    @PluginMethod
    public void updateWidget(PluginCall call) {
        SharedPreferences.Editor e = prefs().edit();
        Integer bg = call.getInt("bgAlpha"), img = call.getInt("imgAlpha");
        if (bg != null) e.putInt("w_bg", bg);
        if (img != null) e.putInt("w_img", img);
        String tone = call.getString("tone");
        if (tone != null) e.putString("w_tone", tone);
        e.apply();
        String png = call.getString("png");
        if (png != null && !png.isEmpty()) {
            try {
                byte[] bytes = android.util.Base64.decode(png, android.util.Base64.DEFAULT);
                File f = new File(getContext().getFilesDir(), TempoWidget.PNG), tmp = new File(f.getAbsolutePath() + ".tmp");
                try (OutputStream o = new FileOutputStream(tmp)) {
                    o.write(bytes);
                }
                if (f.exists()) f.delete();
                tmp.renameTo(f);
            } catch (Exception ignored) {}
        }
        TempoWidget.refresh(getContext());
        call.resolve();
    }

    // ------------------------------------------------------------------ contacts du téléphone

    @PluginMethod
    public void searchContacts(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            requestPermissionForAlias("contacts", call, "contactsPerm");
            return;
        }
        doSearch(call);
    }

    @PermissionCallback
    private void contactsPerm(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED) doSearch(call);
        else call.reject("contacts-refused");
    }

    private void doSearch(PluginCall call) {
        String q = call.getString("q", "").trim();
        JSObject r = new JSObject();
        JSArray out = new JSArray();
        if (q.length() < 2) {
            r.put("contacts", out);
            call.resolve(r);
            return;
        }
        ContentResolver cr = getContext().getContentResolver();
        Map<String, List<String>> phones = new LinkedHashMap<>();
        Map<String, List<String>> emails = new HashMap<>();
        String like = "%" + q + "%";
        try (Cursor c = cr.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            new String[] { ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER },
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " LIKE ?",
            new String[] { like },
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
        )) {
            while (c != null && c.moveToNext()) {
                String name = c.getString(0), num = c.getString(1);
                if (name == null || num == null) continue;
                List<String> l = phones.get(name);
                if (l == null) {
                    if (phones.size() >= 8) continue;
                    l = new ArrayList<>();
                    phones.put(name, l);
                }
                String clean = num.replaceAll("[^0-9+]", "");
                boolean dup = false;
                for (String x : l) if (clean.equals(x.replaceAll("[^0-9+]", ""))) dup = true;
                if (!dup) l.add(num);
            }
        } catch (Exception ignored) {}
        try (Cursor c = cr.query(
            ContactsContract.CommonDataKinds.Email.CONTENT_URI,
            new String[] { ContactsContract.CommonDataKinds.Email.DISPLAY_NAME_PRIMARY, ContactsContract.CommonDataKinds.Email.ADDRESS },
            ContactsContract.CommonDataKinds.Email.DISPLAY_NAME_PRIMARY + " LIKE ?",
            new String[] { like },
            null
        )) {
            while (c != null && c.moveToNext()) {
                String name = c.getString(0), mail = c.getString(1);
                if (name == null || mail == null) continue;
                if (!phones.containsKey(name)) {
                    if (phones.size() >= 8) continue;
                    phones.put(name, new ArrayList<>());
                }
                List<String> l = emails.get(name);
                if (l == null) {
                    l = new ArrayList<>();
                    emails.put(name, l);
                }
                if (!l.contains(mail)) l.add(mail);
            }
        } catch (Exception ignored) {}
        for (Map.Entry<String, List<String>> e : phones.entrySet()) {
            JSObject o = new JSObject();
            o.put("name", e.getKey());
            o.put("phones", new JSArray(e.getValue()));
            List<String> em = emails.get(e.getKey());
            o.put("emails", new JSArray(em != null ? em : new ArrayList<String>()));
            out.put(o);
        }
        r.put("contacts", out);
        call.resolve(r);
    }

    @PluginMethod
    public void pickContact(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
        try {
            startActivityForResult(call, i, "pickResult");
        } catch (ActivityNotFoundException e) {
            call.reject("no_picker");
        }
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            r.put("cancelled", true);
            call.resolve(r);
            return;
        }
        try (Cursor c = getContext().getContentResolver().query(
            result.getData().getData(),
            new String[] { ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER },
            null, null, null
        )) {
            if (c != null && c.moveToFirst()) {
                r.put("name", c.getString(0));
                r.put("phone", c.getString(1));
            }
        } catch (Exception e) {
            r.put("error", String.valueOf(e.getMessage()));
        }
        call.resolve(r);
    }

    // ------------------------------------------------------------------ partage, PDF, agenda, liens

    @PluginMethod
    public void share(PluginCall call) {
        Intent s = new Intent(Intent.ACTION_SEND);
        s.setType("text/plain");
        s.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
        String subject = call.getString("subject");
        if (subject != null) s.putExtra(Intent.EXTRA_SUBJECT, subject);
        Intent ch = Intent.createChooser(s, call.getString("title", "Envoyer"));
        startSafely(ch, call);
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        try {
            String name = call.getString("name", "jarvis.txt").replaceAll("[^A-Za-z0-9._-]", "_");
            File dir = new File(getContext().getCacheDir(), "partage");
            dir.mkdirs();
            File f = new File(dir, name);
            try (OutputStream o = new FileOutputStream(f)) {
                o.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent s = new Intent(Intent.ACTION_SEND);
            s.setType(call.getString("mime", "text/plain"));
            s.putExtra(Intent.EXTRA_STREAM, uri);
            s.putExtra(Intent.EXTRA_SUBJECT, name);
            s.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startSafely(Intent.createChooser(s, call.getString("title", "Enregistrer ou envoyer")), call);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void print(PluginCall call) {
        final String name = call.getString("name", "Nestor");
        getActivity().runOnUiThread(() -> {
            try {
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter ad = getBridge().getWebView().createPrintDocumentAdapter(name);
                pm.print(name, ad, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                call.resolve();
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        });
    }

    @PluginMethod
    public void calendarInsert(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI);
        i.putExtra(CalendarContract.Events.TITLE, call.getString("title", ""));
        i.putExtra(CalendarContract.Events.DESCRIPTION, call.getString("description", ""));
        Long begin = call.getLong("begin"), end = call.getLong("end");
        if (begin != null) i.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, (long) begin);
        if (end != null) i.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, (long) end);
        i.putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, (boolean) call.getBoolean("allDay", false));
        startSafely(i, call);
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("url");
            return;
        }
        startSafely(new Intent(Intent.ACTION_VIEW, Uri.parse(url)), call);
    }

    private void startSafely(Intent i, PluginCall call) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("no_app");
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    // ------------------------------------------------------------------ mise à jour de l'intérieur (page web)

    @PluginMethod
    public void updateWeb(PluginCall call) {
        final String base = call.getString("base");
        final String version = call.getString("version", "").replaceAll("[^A-Za-z0-9._-]", "_");
        final JSArray files = call.getArray("files");
        if (base == null || version.isEmpty() || files == null || !base.startsWith("https://")) {
            call.reject("bad_request");
            return;
        }
        new Thread(() -> {
            try {
                File root = new File(getContext().getFilesDir(), "web");
                File dir = new File(root, version);
                dir.mkdirs();
                for (int k = 0; k < files.length(); k++) {
                    String f = files.getString(k);
                    if (f.contains("..") || f.startsWith("/")) continue;
                    File dest = new File(dir, f);
                    if (dest.getParentFile() != null) dest.getParentFile().mkdirs();
                    download(base + f + "?v=" + version, dest);
                }
                File index = new File(dir, "index.html");
                if (!index.exists() || index.length() < 2000) throw new Exception("index.html incomplet");
                // ménage : on ne garde que cette version
                File[] olds = root.listFiles();
                if (olds != null) for (File o : olds) if (!o.getName().equals(version)) deleteRec(o);
                prefs().edit().putBoolean("web_pending", true).putString("web_version", version).apply();
                getContext()
                    .getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE)
                    .edit()
                    .putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, dir.getAbsolutePath())
                    .apply();
                call.resolve();
                getBridge().setServerBasePath(dir.getAbsolutePath());
            } catch (Exception e) {
                call.reject("update: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void webReady(PluginCall call) {
        prefs().edit().putBoolean("web_pending", false).apply();
        JSObject r = new JSObject();
        r.put("web", prefs().getString("web_version", ""));
        r.put("native", NATIVE_BUILD);
        call.resolve(r);
    }

    @PluginMethod
    public void webReset(PluginCall call) {
        prefs().edit().putBoolean("web_pending", false).putString("web_version", "").apply();
        getContext()
            .getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE)
            .edit()
            .putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, "")
            .apply();
        call.resolve();
        getBridge().setServerAssetPath("public");
    }

    private static void download(String url, File dest) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("Cache-Control", "no-cache");
        int code = c.getResponseCode();
        if (code != 200) throw new Exception("HTTP " + code + " " + url);
        File tmp = new File(dest.getAbsolutePath() + ".tmp");
        try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(tmp)) {
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        } finally {
            c.disconnect();
        }
        if (dest.exists()) dest.delete();
        if (!tmp.renameTo(dest)) throw new Exception("rename");
    }

    private static void deleteRec(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteRec(k);
        f.delete();
    }

    /** écran allumé pendant une dictée (sinon la veille coupe la phrase) */
    @PluginMethod
    public void keepScreen(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    /** Tempo quitte l'écran : on rend tout de suite le micro et la reconnaissance vocale aux autres applis */
    @Override
    protected void handleOnPause() {
        try {
            if (sr != null) {
                sr.cancel();
                sr.destroy();
                sr = null;
            }
            if (tts != null) tts.stop();
            for (PluginCall c : speakCalls.values()) c.resolve();
            speakCalls.clear();
        } catch (Exception ignored) {}
        super.handleOnPause();
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (tts != null) tts.shutdown();
            if (sr != null) sr.destroy();
        } catch (Exception ignored) {}
        super.handleOnDestroy();
    }
}
