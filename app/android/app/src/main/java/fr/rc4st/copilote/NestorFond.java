package fr.rc4st.copilote;

import android.content.Context;
import android.media.MediaPlayer;
import android.service.wallpaper.WallpaperService;
import android.view.SurfaceHolder;
import java.io.File;

/**
 * Lot 29 : le fond d'écran animé de Nestor.
 * Il joue en boucle la vidéo choisie dans les réglages de l'appli (files/fond/actuel.mp4),
 * se met en pause dès que l'écran d'accueil n'est plus visible (appli ouverte, écran éteint)
 * et recharge la boucle quand on en choisit une autre.
 * Aucun dessin à la main sur la surface : la vidéo seule y écrit (sinon le lecteur ne peut plus s'y brancher).
 */
public class NestorFond extends WallpaperService {

    static File fichier(Context c) {
        return new File(new File(c.getFilesDir(), "fond"), "actuel.mp4");
    }

    @Override
    public Engine onCreateEngine() {
        return new Moteur();
    }

    class Moteur extends Engine {
        private MediaPlayer mp;
        private long charge = -1;
        private boolean visible = false;
        private boolean pret = false;

        @Override
        public void onSurfaceCreated(SurfaceHolder h) {
            super.onSurfaceCreated(h);
            prepare(h);
        }

        @Override
        public void onSurfaceDestroyed(SurfaceHolder h) {
            libere();
            super.onSurfaceDestroyed(h);
        }

        @Override
        public void onVisibilityChanged(boolean v) {
            visible = v;
            File f = fichier(NestorFond.this);
            // une autre boucle a été choisie dans l'appli : on la prend en revenant sur l'accueil
            if (v && f.exists() && (mp == null || f.lastModified() != charge)) {
                libere();
                prepare(getSurfaceHolder());
                return;
            }
            if (mp == null || !pret) return;
            try {
                if (v) mp.start(); else mp.pause();
            } catch (Exception ignored) {}
        }

        private void prepare(SurfaceHolder h) {
            File f = fichier(NestorFond.this);
            if (h == null || !f.exists()) return;
            try {
                pret = false;
                mp = new MediaPlayer();
                mp.setSurface(h.getSurface());
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
                mp.setOnErrorListener((p, quoi, extra) -> {
                    libere();
                    return true;
                });
                charge = f.lastModified();
                mp.prepareAsync();
            } catch (Exception e) {
                libere();
            }
        }

        private void libere() {
            pret = false;
            if (mp == null) return;
            try { mp.stop(); } catch (Exception ignored) {}
            try { mp.release(); } catch (Exception ignored) {}
            mp = null;
        }

        @Override
        public void onDestroy() {
            libere();
            super.onDestroy();
        }
    }
}
