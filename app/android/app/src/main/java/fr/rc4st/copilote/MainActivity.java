package fr.rc4st.copilote;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // le plugin maison doit être enregistré avant que le pont Capacitor ne démarre
        registerPlugin(TempoNativePlugin.class);
        super.onCreate(savedInstanceState);
        assistVerrou(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        assistVerrou(intent);
        super.onNewIntent(intent);
    }

    /** lot 21 : appui long sur l'écouteur (commande vocale Bluetooth) ou assistant du téléphone */
    static boolean estAssist(Intent i) {
        String a = i != null ? i.getAction() : null;
        return Intent.ACTION_VOICE_COMMAND.equals(a) || Intent.ACTION_ASSIST.equals(a) || "android.intent.action.VOICE_ASSIST".equals(a);
    }

    /* écran verrouillé : Nestor s'affiche par-dessus le temps de l'échange (la page masque tout le reste) */
    private void assistVerrou(Intent i) {
        if (!estAssist(i)) return;
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
    }

    /** fin de l'échange : Nestor ne s'affiche plus sur l'écran verrouillé ; « fond » = retour à l'écran verrouillé */
    void finVerrou(boolean fond) {
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(false);
            setTurnScreenOn(false);
        }
        if (fond) moveTaskToBack(true);
    }
}
