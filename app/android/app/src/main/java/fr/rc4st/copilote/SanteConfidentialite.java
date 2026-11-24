package fr.rc4st.copilote;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/**
 * Health Connect exige une page de confidentialité : elle s'ouvre depuis l'écran d'autorisation
 * (« pourquoi Nestor demande ces données ? ») et depuis les réglages Android.
 */
public class SanteConfidentialite extends Activity {

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("https://r4c4st.github.io/copilote/confidentialite.html#sante"));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception ignored) {}
        finish();
    }
}
