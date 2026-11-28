package fr.rc4st.copilote;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffColorFilter;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.service.wallpaper.WallpaperService;
import android.view.MotionEvent;
import android.view.SurfaceHolder;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Lot 29-30 : le fond d'écran animé de Nestor.
 * Lot 30 : le fond se dessine en direct (décor fixe + éléments animés décrits par scene.json) et réagit à Nestor :
 * la journée en or (une étoile par chose réglée aujourd'hui), un rappel proche (ambre) ou en retard (rouge),
 * les messages en attente (des influx vers le cœur), les teintes selon l'heure, une onde au toucher.
 * Le cœur de Nestor (la constellation qui remplace le widget) n'apparaît que sur la première page d'accueil
 * quand le téléphone dit quelle page est affichée. En mode économie d'énergie, le fond se fige.
 * Sans scène, il rejoue l'ancienne boucle vidéo (lot 29).
 */
public class NestorFond extends WallpaperService {

    static File dossier(Context c) { return new File(c.getFilesDir(), "fond"); }
    static File fichier(Context c) { return new File(dossier(c), "actuel.mp4"); }
    static File scene(Context c) { return new File(dossier(c), "scene.json"); }
    static File decor(Context c) { return new File(dossier(c), "decor.jpg"); }

    static final float LW = 1080f, LH = 2340f;
    static final int[][] PAL = {
        {46, 184, 196}, {143, 214, 220}, {255, 255, 255}, {96, 140, 232}, {185, 201, 245},
        {214, 158, 58}, {242, 205, 130}, {238, 166, 76}, {236, 95, 95}
    };

    @Override
    public Engine onCreateEngine() { return new Moteur(); }

    class Moteur extends Engine implements SharedPreferences.OnSharedPreferenceChangeListener {
        // vidéo (lot 29)
        private MediaPlayer mp;
        private long charge = -1;
        private boolean pret = false;
        // scène (lot 30)
        private JSONObject sc;
        private long sceneCharge = -1;
        private Bitmap decorBmp;
        private final Handler h = new Handler(Looper.getMainLooper());
        private final Runnable image = this::image;
        private boolean visible = false, enCours = false;
        private int sw = 0, sh = 0;
        private float k = 1f, dx = 0f, dy = 0f;
        private long t0 = SystemClock.uptimeMillis();
        // état de Nestor
        private long[] faits = new long[0], rappels = new long[0];
        private int or = 0, orAvant = -1, naissance = -1, msgs = 0;
        private long naissanceT = 0, etatT = 0;
        private float coeur = 1f;
        private Float premierDecalage = null;
        private boolean decalagesVus = false;
        private float xOff = 0f, xPas = 0f;
        private final List<float[]> ondes = new ArrayList<>();
        private float downX, downY;
        private long downT;
        // pinceaux
        private final Paint plein = new Paint(Paint.ANTI_ALIAS_FLAG), trait = new Paint(Paint.ANTI_ALIAS_FLAG), image_ = new Paint(Paint.FILTER_BITMAP_FLAG);
        private final Map<Integer, Paint> lueurs = new HashMap<>();
        private Bitmap lueur;
        private final RectF rect = new RectF();
        private Path etoile;
        // paramètres tirés une fois par scène (dérive, scintillement, influx)
        private float[][] ptsP, twP, arcP;
        private float[][] coeurP;

        @Override
        public void onCreate(SurfaceHolder holder) {
            super.onCreate(holder);
            setTouchEventsEnabled(true);
            trait.setStyle(Paint.Style.STROKE);
            trait.setStrokeCap(Paint.Cap.ROUND);
            plein.setStyle(Paint.Style.FILL);
            preparePinceaux();
            prefs().registerOnSharedPreferenceChangeListener(this);
            litEtat();
        }

        private SharedPreferences prefs() { return getSharedPreferences(TempoNativePlugin.PREFS, Context.MODE_PRIVATE); }

        @Override
        public void onSharedPreferenceChanged(SharedPreferences p, String cle) {
            if (cle != null && cle.startsWith("fond_")) { litEtat(); if (visible && !enCours) h.post(image); }
        }

        @Override
        public void onSurfaceCreated(SurfaceHolder holder) {
            super.onSurfaceCreated(holder);
            if (!chargeScene()) prepareVideo(holder);
        }

        @Override
        public void onSurfaceChanged(SurfaceHolder holder, int format, int w, int hh) {
            super.onSurfaceChanged(holder, format, w, hh);
            sw = w; sh = hh;
            k = Math.max(w / LW, hh / LH);
            dx = (w - LW * k) / 2f; dy = (hh - LH * k) / 2f;
            if (sc != null) relance();
        }

        @Override
        public void onSurfaceDestroyed(SurfaceHolder holder) {
            arrete();
            libereVideo();
            super.onSurfaceDestroyed(holder);
        }

        @Override
        public void onVisibilityChanged(boolean v) {
            visible = v;
            if (v) {
                if (temps() > 3600) { t0 = SystemClock.uptimeMillis(); ondes.clear(); }   // le temps reste petit : les mouvements restent fluides
                litEtat();
                File s = scene(NestorFond.this);
                // une autre scène (ou la première) a été rangée : on la prend en revenant sur l'accueil
                if (s.exists() && decor(NestorFond.this).exists() && (sc == null || s.lastModified() != sceneCharge)) {
                    libereVideo();
                    if (chargeScene()) { relance(); return; }
                }
                if (sc != null) { relance(); return; }
                File f = fichier(NestorFond.this);
                if (f.exists() && (mp == null || f.lastModified() != charge)) { libereVideo(); prepareVideo(getSurfaceHolder()); return; }
                if (mp != null && pret) try { mp.start(); } catch (Exception ignored) {}
            } else {
                arrete();
                if (mp != null && pret) try { mp.pause(); } catch (Exception ignored) {}
            }
        }

        @Override
        public void onOffsetsChanged(float xOffset, float yOffset, float xStep, float yStep, int xPx, int yPx) {
            if (premierDecalage == null) premierDecalage = xOffset;
            else if (Math.abs(xOffset - premierDecalage) > 0.001f) decalagesVus = true;
            xOff = xOffset; xPas = xStep;
            if (sc != null && visible && !enCours) h.post(image);
        }

        @Override
        public void onTouchEvent(MotionEvent e) {
            if (e.getAction() == MotionEvent.ACTION_DOWN) { downX = e.getX(); downY = e.getY(); downT = SystemClock.uptimeMillis(); }
            else if (e.getAction() == MotionEvent.ACTION_UP && SystemClock.uptimeMillis() - downT < 300 && Math.hypot(e.getX() - downX, e.getY() - downY) < 30) onde(e.getX(), e.getY());
        }

        @Override
        public Bundle onCommand(String action, int x, int y, int z, Bundle extras, boolean resultRequested) {
            if ("android.wallpaper.tap".equals(action)) onde(x, y);
            return null;
        }

        private void onde(float x, float y) {
            if (sc == null) return;
            float lx = (x - dx) / k, ly = (y - dy) / k, t = temps();
            for (float[] o : ondes) if (t - o[2] < .2f && Math.hypot(o[0] - lx, o[1] - ly) < 40) return;   // même toucher signalé deux fois
            ondes.add(new float[]{lx, ly, t});
            if (visible && !enCours) relance();
        }

        @Override
        public void onDestroy() {
            arrete();
            libereVideo();
            try { prefs().unregisterOnSharedPreferenceChangeListener(this); } catch (Exception ignored) {}
            super.onDestroy();
        }

        /* ------------------------------------------------------------ état de Nestor */

        private void litEtat() {
            SharedPreferences p = prefs();
            faits = tableau(p.getString("fond_or", "[]"));
            rappels = tableau(p.getString("fond_rappels", "[]"));
            calculeEtat(true);
        }

        private long[] tableau(String s) {
            try { JSONArray a = new JSONArray(s); long[] r = new long[a.length()]; for (int i = 0; i < r.length; i++) r[i] = a.optLong(i); return r; }
            catch (Exception e) { return new long[0]; }
        }

        private void calculeEtat(boolean force) {
            long now = System.currentTimeMillis();
            if (!force && now - etatT < 5000) return;
            etatT = now;
            Calendar c = Calendar.getInstance();
            c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
            long minuit = c.getTimeInMillis();
            int n = 0;
            for (long f : faits) if (f >= minuit) n++;
            if (orAvant >= 0 && n > orAvant) { naissance = n - 1; naissanceT = SystemClock.uptimeMillis(); }
            orAvant = n; or = n;
            msgs = Math.min(5, TempoNotifListener.enAttente());
        }

        /** null, "proche" (dans le quart d'heure) ou "retard" (passé depuis moins de 6 h, pas encore réglé) */
        private String rappel() {
            long now = System.currentTimeMillis();
            boolean proche = false;
            for (long r : rappels) {
                if (r <= now && now - r < 6 * 3600_000L) return "retard";
                if (r > now && r - now <= 15 * 60_000L) proche = true;
            }
            return proche ? "proche" : null;
        }

        /* ------------------------------------------------------------ scène */

        private boolean chargeScene() {
            File s = scene(NestorFond.this), d = decor(NestorFond.this);
            if (!s.exists() || !d.exists()) return false;
            try {
                byte[] b = new byte[(int) s.length()];
                try (FileInputStream in = new FileInputStream(s)) { int lu = 0; while (lu < b.length) { int n = in.read(b, lu, b.length - lu); if (n < 0) break; lu += n; } }
                JSONObject o = new JSONObject(new String(b, StandardCharsets.UTF_8));
                BitmapFactory.Options op = new BitmapFactory.Options();
                op.inPreferredConfig = Bitmap.Config.ARGB_8888;
                Bitmap bm = BitmapFactory.decodeFile(d.getAbsolutePath(), op);
                if (bm == null) return false;
                if (decorBmp != null && decorBmp != bm) decorBmp.recycle();
                decorBmp = bm;
                sc = o;
                sceneCharge = s.lastModified();
                tireParametres();
                return true;
            } catch (Throwable e) {
                sc = null;
                return false;
            }
        }

        private void tireParametres() {
            Random r = new Random(99);
            JSONArray pts = sc.optJSONArray("pts"), tw = sc.optJSONArray("tw"), arcs = sc.optJSONArray("arcs");
            ptsP = new float[pts == null ? 0 : pts.length()][];
            for (int i = 0; i < ptsP.length; i++) ptsP[i] = new float[]{1 + r.nextInt(2), 1 + r.nextInt(2), 1 + r.nextInt(3), r.nextFloat() * 6.2832f, r.nextFloat() * 6.2832f, r.nextFloat() * 6.2832f, .5f + r.nextFloat()};
            twP = new float[tw == null ? 0 : tw.length()][];
            for (int i = 0; i < twP.length; i++) twP[i] = new float[]{1 + r.nextInt(3), r.nextFloat() * 6.2832f};
            arcP = new float[arcs == null ? 0 : arcs.length()][];
            for (int i = 0; i < arcP.length; i++) arcP[i] = new float[]{r.nextFloat() < .42f ? 1 : 0, r.nextFloat(), .1f + r.nextFloat() * .12f, r.nextFloat() < .5f ? 1 : 0};
            Random c = new Random(424242);
            coeurP = new float[84][];
            for (int i = 0; i < 84; i++) coeurP[i] = new float[]{c.nextFloat() * 6.2832f, 34 + (float) Math.pow(c.nextFloat(), .8) * 108, .6f + c.nextFloat() * 1.6f, c.nextFloat() * 6.2832f, (c.nextFloat() - .5f) * .13f};
        }

        /* ------------------------------------------------------------ boucle */

        private float temps() { return (SystemClock.uptimeMillis() - t0) / 1000f; }

        private boolean economie() {
            try { PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE); return pm != null && pm.isPowerSaveMode(); }
            catch (Exception e) { return false; }
        }

        private void relance() { h.removeCallbacks(image); h.post(image); }

        private void arrete() { h.removeCallbacks(image); enCours = false; }

        private void image() {
            h.removeCallbacks(image);
            if (sc == null || sw == 0) { enCours = false; return; }
            calculeEtat(false);
            SurfaceHolder holder = getSurfaceHolder();
            Canvas c = null;
            try {
                c = Build.VERSION.SDK_INT >= 26 ? holder.lockHardwareCanvas() : holder.lockCanvas();
                if (c != null) dessine(c, temps());
            } catch (Throwable ignored) {
            } finally {
                if (c != null) try { holder.unlockCanvasAndPost(c); } catch (Throwable ignored) {}
            }
            int heure = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
            enCours = visible && !economie();
            if (enCours) h.postDelayed(image, (heure >= 23 || heure < 6) ? 50 : 33);
        }

        /* ------------------------------------------------------------ dessin (suit le rendu de référence) */

        private void dessine(Canvas c, float t) {
            c.drawColor(Color.BLACK);
            c.save();
            c.translate(dx, dy);
            c.scale(k, k);
            rect.set(0, 0, LW, LH);
            c.drawBitmap(decorBmp, null, rect, image_);
            int heure = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
            if (heure >= 22 || heure < 6) c.drawColor(Color.argb(56, 0, 0, 0));
            else if (heure >= 18) c.drawColor(Color.argb(18, 40, 70, 160));
            else if (heure < 9) c.drawColor(Color.argb(13, 255, 214, 170));
            String style = sc.optString("style");
            // poussière qui scintille
            JSONArray tw = sc.optJSONArray("tw");
            if (tw != null && !"art-deco".equals(style)) for (int i = 0; i < tw.length(); i++) {
                JSONArray p = tw.optJSONArray(i);
                double v = Math.pow(Math.max(0, Math.sin(t * .52 * twP[i][0] + twP[i][1])), 2);
                if (v > .02) point(c, (float) p.optDouble(0), (float) p.optDouble(1), (float) p.optDouble(2), PAL[p.optInt(3)], (float) (.75 * v), 0);
            }
            // étoiles reliées
            JSONArray pts = sc.optJSONArray("pts");
            if (pts != null) {
                JSONObject l = sc.optJSONObject("lien");
                int n = pts.length(); float A = (float) sc.optDouble("drift", 6);
                float[] x = new float[n], y = new float[n];
                for (int i = 0; i < n; i++) { JSONArray p = pts.optJSONArray(i); float[] q = ptsP[i];
                    x[i] = (float) (p.optDouble(0) + A * q[6] * Math.sin(t * .52 * q[0] + q[3])); y[i] = (float) (p.optDouble(1) + A * q[6] * Math.cos(t * .52 * q[1] + q[4])); }
                liens(c, x, y, (float) l.optDouble("d", 100), PAL[l.optInt("ci", 1)], (float) l.optDouble("a", .25), (float) l.optDouble("w", 1));
                for (int i = 0; i < n; i++) { JSONArray p = pts.optJSONArray(i);
                    float al = (float) (p.optDouble(4) * (.72 + .28 * Math.sin(t * .52 * ptsP[i][2] + ptsP[i][5])));
                    point(c, x[i], y[i], (float) p.optDouble(2), PAL[p.optInt(5)], al, p.optInt(3) == 1 ? 3.2f : 0); }
            }
            // réseau neuronal : influx et neurones qui s'allument
            JSONArray arcs = sc.optJSONArray("arcs"), neur = sc.optJSONArray("neur");
            if (arcs != null && neur != null) {
                float[] flash = new float[neur.length()];
                for (int i = 0; i < arcs.length(); i++) {
                    if (arcP[i][0] == 0) continue;
                    JSONArray e = arcs.optJSONArray(i); JSONArray a = neur.optJSONArray(e.optInt(0)), b = neur.optJSONArray(e.optInt(1));
                    float g = (float) (((t / 12f - arcP[i][1]) % 1 + 1) % 1), d = arcP[i][2]; boolean rev = arcP[i][3] == 1;
                    if (g < d) { float u = g / d; influx(c, (float) a.optDouble(0), (float) a.optDouble(1), (float) e.optDouble(2), (float) e.optDouble(3), (float) b.optDouble(0), (float) b.optDouble(1), u, melange(PAL[1], PAL[2], .45f), (float) Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.1)), .6), rev, 1); }
                    float dt = g - d; if (dt >= 0 && dt < .06f) { int kk = rev ? e.optInt(0) : e.optInt(1); flash[kk] = Math.max(flash[kk], 1 - dt / .06f); }
                }
                for (int i = 0; i < flash.length; i++) if (flash[i] > 0) { JSONArray m = neur.optJSONArray(i); int[] col = {m.optInt(3), m.optInt(4), m.optInt(5)}; float s = (float) m.optDouble(2);
                    lueur(c, (float) m.optDouble(0), (float) m.optDouble(1), s * 9, melange(col, PAL[2], .3f), .45f * flash[i]);
                    point(c, (float) m.optDouble(0), (float) m.optDouble(1), s * (1 + .5f * flash[i]), new int[]{240, 253, 255}, .9f * flash[i], 0); }
            }
            // art déco : le faisceau qui tourne
            JSONObject rays = sc.optJSONObject("rays");
            if (rays != null) {
                float ox = (float) rays.optDouble("x"), oy = (float) rays.optDouble("y"), r0 = (float) rays.optDouble("r0"), cercle = (float) rays.optDouble("cercle");
                int n = rays.optInt("n", 112);
                double th = -Math.PI / 2 + 2 * Math.PI * ((t / 24f) % 1), env = .75 + .25 * Math.sin(t * 1.04);
                for (int i = 0; i < n; i++) {
                    double a = 2 * Math.PI * i / n; boolean lg = i % 2 == 0;
                    double d = Math.abs(((a - th) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI), bb = env * Math.exp(-Math.pow(d / .16, 2));
                    if (bb < .01) continue;
                    float L = (float) (lg ? rays.optDouble("long") : rays.optDouble("court")), ca = (float) Math.cos(a), sa = (float) Math.sin(a);
                    float x0 = ox + ca * r0, y0 = oy + sa * r0, x1 = ox + ca * L, y1 = oy + sa * L;
                    trait.setShader(new LinearGradient(x0, y0, x1, y1, new int[]{couleur(PAL[6], (float) (.7 * bb)), couleur(PAL[6], (float) (.3 * bb)), couleur(PAL[6], 0)}, new float[]{0, .4f, 1}, Shader.TileMode.CLAMP));
                    trait.setStrokeWidth(lg ? 1.8f : 1.3f);
                    c.drawLine(x0, y0, x1, y1, trait);
                    trait.setShader(null);
                }
                for (int j = -3; j <= 3; j++) { double a = th + j * .04; point(c, (float) (ox + Math.cos(a) * cercle), (float) (oy + Math.sin(a) * cercle), 1.6f, new int[]{255, 228, 160}, (float) (.85 * env * (1 - Math.abs(j) / 4.0)), 0); }
                if (tw != null) for (int i = 0; i < tw.length(); i++) { JSONArray p = tw.optJSONArray(i);
                    float v = (float) Math.max(0, Math.sin(t * .52 * (1 + (int) twP[i][0] % 2) + twP[i][1]));
                    if (v > .05f) etincelle(c, (float) p.optDouble(0), (float) p.optDouble(1), (float) p.optDouble(2) * v, v); }
            }
            // la journée en or
            JSONObject o = sc.optJSONObject("or");
            if (o != null) {
                JSONArray slots = o.optJSONArray("slots");
                int n = Math.min(or, slots == null ? 0 : slots.length());
                float age = (SystemClock.uptimeMillis() - naissanceT) / 1000f;
                if ("neurone".equals(o.optString("mode")) && neur != null && arcs != null) {
                    JSONArray noeuds = o.optJSONArray("noeuds");
                    for (int kk = 0; kk < n; kk++) {
                        int ni = noeuds.optInt(kk); JSONArray m = neur.optJSONArray(ni); float mx = (float) m.optDouble(0), my = (float) m.optDouble(1);
                        float bb = kk == naissance && age < 1.8f ? 1 - age / 1.8f : 0;
                        lueur(c, mx, my, 60 * (1 + bb), PAL[5], .22f + .3f * bb);
                        point(c, mx, my, 6.5f, PAL[6], 1, 0);
                        etincelle(c, mx, my, 4.4f * (1 + bb), .9f);
                        for (int i = 0; i < arcs.length(); i++) { JSONArray e = arcs.optJSONArray(i); if (e.optInt(0) != ni && e.optInt(1) != ni) continue;
                            JSONArray a = neur.optJSONArray(e.optInt(0)), b = neur.optJSONArray(e.optInt(1)); float u = (float) ((t / 3f + kk * .27f + e.optDouble(2) * .001) % 1);
                            influx(c, (float) a.optDouble(0), (float) a.optDouble(1), (float) e.optDouble(2), (float) e.optDouble(3), (float) b.optDouble(0), (float) b.optDouble(1), u, PAL[6], (float) (.9 * Math.sin(Math.PI * u)), e.optInt(1) == ni, 1); }
                    }
                } else if (slots != null) {
                    float taille = (float) o.optDouble("taille", 5);
                    if (o.optBoolean("lien")) for (int i = 1; i < n; i++) { JSONArray a = slots.optJSONArray(i - 1), b = slots.optJSONArray(i);
                        trait.setColor(couleur(PAL[5], .34f)); trait.setStrokeWidth(1.2f); c.drawLine((float) a.optDouble(0), (float) a.optDouble(1), (float) b.optDouble(0), (float) b.optDouble(1), trait); }
                    for (int i = 0; i < slots.length(); i++) { JSONArray p = slots.optJSONArray(i); float px = (float) p.optDouble(0), py = (float) p.optDouble(1);
                        if (i >= n) { point(c, px, py, 1.6f, PAL[6], .32f, 0); continue; }
                        float w = (float) Math.sin(t * 1.04 + i * 1.7), bb = i == naissance && age < 1.8f ? 1 - age / 1.8f : 0;
                        etincelle(c, px, py, taille * (1 + .13f * w) * (1 + bb * 1.6f), .84f + .16f * w);
                        if (bb > 0) lueur(c, px, py, 90, PAL[6], .45f * bb); }
                }
            }
            // le cœur de Nestor (à la place du widget), seulement sur la première page quand le téléphone le dit
            float cible = decalagesVus && xPas > 0 && xPas < 1 ? Math.max(0, Math.min(1, 1 - xOff / xPas)) : 1;
            coeur += (cible - coeur) * .25f;
            JSONObject C = sc.optJSONObject("coeur");
            if (C != null && coeur > .01f) {
                float cx = (float) C.optDouble("x"), cy = (float) C.optDouble("y"), kc = (float) C.optDouble("r", 150) / 142f;
                int[] col = PAL[C.optInt("ci")], lcol = PAL[C.optInt("lci")];
                float ka = coeur;
                String rp = rappel();
                if (rp != null) { int[] rc = "retard".equals(rp) ? PAL[8] : PAL[7]; float v = (float) (.55 + .45 * Math.sin(t * Math.PI));
                    lueur(c, cx, cy, 250 * kc, rc, .4f * v * ka);
                    trait.setColor(couleur(rc, .55f * v * ka)); trait.setStrokeWidth(2.4f); c.drawCircle(cx, cy, (158 + 8 * v) * kc, trait); }
                lueur(c, cx, cy, 115 * kc, col, .2f * ka);
                float[] x = new float[84], y = new float[84];
                for (int i = 0; i < 84; i++) { float[] p = coeurP[i]; double a = p[0] + p[4] * t, rr = (p[1] + Math.sin(t / 1.9 + p[3]) * 12) * kc;
                    x[i] = (float) (cx + Math.cos(a) * rr); y[i] = (float) (cy + Math.sin(a) * rr); }
                liens(c, x, y, 36 * kc, lcol, .34f * ka, 1);
                for (int i = 0; i < 84; i++) { float[] p = coeurP[i];
                    point(c, x[i], y[i], p[2] * 1.7f, i % 3 == 0 ? PAL[2] : col, (float) Math.min(1, .55 + .35 * Math.sin(t / .65 + p[3])) * ka, p[2] > 1.5f ? 3.2f : 0); }
                point(c, cx, cy, 5.5f, new int[]{235, 252, 255}, .95f * ka, 6);
                for (int i = 0; i < msgs; i++) {
                    double an = -2.3 + i * 1.05, d0 = 720;
                    float sx = (float) Math.max(40, Math.min(LW - 40, cx + Math.cos(an) * d0)), sy = (float) Math.max(160, Math.min(LH - 200, cy + Math.sin(an) * d0));
                    float qx = (float) ((sx + cx) / 2 + Math.cos(an + 1.57) * 160), qy = (float) ((sy + cy) / 2 + Math.sin(an + 1.57) * 160), u = (t / 3.5f + i * .37f) % 1;
                    influx(c, sx, sy, qx, qy, cx, cy, u * .96f, melange(PAL[1], PAL[2], .5f), (float) Math.pow(Math.sin(Math.PI * u), .5) * ka, false, 1.5f);
                }
            }
            // les ondes du toucher
            for (int i = ondes.size() - 1; i >= 0; i--) { float[] w = ondes.get(i); float age = t - w[2];
                if (age > 1.4f) { ondes.remove(i); continue; }
                float f = age / 1.4f; trait.setColor(couleur(PAL[1], .55f * (1 - f))); trait.setStrokeWidth(2);
                c.drawCircle(w[0], w[1], 20 + 260 * (float) Math.sqrt(f), trait); lueur(c, w[0], w[1], 120, PAL[1], .25f * (1 - f)); }
            c.restore();
        }

        /* ------------------------------------------------------------ petits outils de dessin */

        private int couleur(int[] c, float a) { return Color.argb(Math.max(0, Math.min(255, Math.round(a * 255))), c[0], c[1], c[2]); }

        private int[] melange(int[] a, int[] b, float t) { return new int[]{Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)}; }

        private void preparePinceaux() {
            int n = 128; lueur = Bitmap.createBitmap(n, n, Bitmap.Config.ARGB_8888);
            Canvas cv = new Canvas(lueur); Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setShader(new RadialGradient(n / 2f, n / 2f, n / 2f, new int[]{Color.WHITE, Color.argb(115, 255, 255, 255), Color.TRANSPARENT}, new float[]{0, .45f, 1}, Shader.TileMode.CLAMP));
            cv.drawCircle(n / 2f, n / 2f, n / 2f, p);
            etoile = new Path(); float L = 3.4f, q = .32f;
            etoile.moveTo(0, -L); etoile.quadTo(q, -q, L, 0); etoile.quadTo(q, q, 0, L); etoile.quadTo(-q, q, -L, 0); etoile.quadTo(-q, -q, 0, -L); etoile.close();
        }

        private void lueur(Canvas c, float x, float y, float r, int[] col, float a) {
            if (a <= .004f || r <= 0) return;
            int cle = (col[0] << 16) | (col[1] << 8) | col[2];
            Paint p = lueurs.get(cle);
            if (p == null) { p = new Paint(Paint.FILTER_BITMAP_FLAG); p.setColorFilter(new PorterDuffColorFilter(Color.rgb(col[0], col[1], col[2]), PorterDuff.Mode.SRC_IN)); lueurs.put(cle, p); }
            p.setAlpha(Math.max(0, Math.min(255, Math.round(a * 255))));
            rect.set(x - r, y - r, x + r, y + r);
            c.drawBitmap(lueur, null, rect, p);
        }

        private void point(Canvas c, float x, float y, float r, int[] col, float a, float halo) {
            if (a <= .004f) return;
            if (halo > 0) lueur(c, x, y, r * halo, col, a * .32f);
            plein.setColor(couleur(col, a));
            c.drawCircle(x, y, r, plein);
        }

        private void liens(Canvas c, float[] x, float[] y, float maxD, int[] col, float la, float w) {
            trait.setStrokeWidth(w);
            float m2 = maxD * maxD;
            for (int i = 0; i < x.length; i++) for (int j = i + 1; j < x.length; j++) {
                float ddx = x[i] - x[j], ddy = y[i] - y[j], d2 = ddx * ddx + ddy * ddy;
                if (d2 < m2) { float d = (float) Math.sqrt(d2); trait.setColor(couleur(col, la * (1 - d / maxD))); c.drawLine(x[i], y[i], x[j], y[j], trait); }
            }
        }

        private void etincelle(Canvas c, float x, float y, float r, float a) {
            lueur(c, x, y, r * 7, PAL[5], .22f * a);
            plein.setColor(couleur(PAL[6], .9f * a));
            c.save(); c.translate(x, y); c.scale(r, r); c.drawPath(etoile, plein); c.restore();
            point(c, x, y, r * .62f, new int[]{255, 244, 220}, a, 0);
        }

        private void influx(Canvas c, float ax, float ay, float qx, float qy, float bx, float by, float u, int[] col, float a, boolean rev, float z) {
            if (a <= .01f) return;
            for (int j = 7; j >= 0; j--) {
                float v = rev ? 1 - (u - j * .018f) : u - j * .018f;
                if (v < 0 || v > 1) continue;
                float w = 1 - v, x = w * w * ax + 2 * w * v * qx + v * v * bx, y = w * w * ay + 2 * w * v * qy + v * v * by, f = 1 - j / 8f;
                point(c, x, y, (.8f + 2.2f * f) * z, col, a * f, 0);
            }
            float v = rev ? 1 - u : u, w = 1 - v;
            lueur(c, w * w * ax + 2 * w * v * qx + v * v * bx, w * w * ay + 2 * w * v * qy + v * v * by, 16 * z, col, .45f * a);
        }

        /* ------------------------------------------------------------ vidéo (lot 29), sans scène */

        private void prepareVideo(SurfaceHolder holder) {
            File f = fichier(NestorFond.this);
            if (holder == null || !f.exists()) return;
            try {
                pret = false;
                mp = new MediaPlayer();
                mp.setSurface(holder.getSurface());
                mp.setDataSource(f.getAbsolutePath());
                mp.setLooping(true);
                mp.setVolume(0f, 0f);
                mp.setOnPreparedListener(p -> {
                    pret = true;
                    try {
                        p.setVideoScalingMode(MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING);
                        if (visible || isVisible()) p.start();
                    } catch (Exception ignored) {}
                });
                mp.setOnErrorListener((p, quoi, extra) -> { libereVideo(); return true; });
                charge = f.lastModified();
                mp.prepareAsync();
            } catch (Exception e) {
                libereVideo();
            }
        }

        private void libereVideo() {
            pret = false;
            if (mp == null) return;
            try { mp.stop(); } catch (Exception ignored) {}
            try { mp.release(); } catch (Exception ignored) {}
            mp = null;
        }
    }
}
