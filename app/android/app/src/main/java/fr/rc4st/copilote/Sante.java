package fr.rc4st.copilote;

import android.content.Context;
import android.content.pm.PackageManager;
import android.health.connect.AggregateRecordsGroupedByPeriodResponse;
import android.health.connect.AggregateRecordsRequest;
import android.health.connect.AggregateRecordsResponse;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.LocalTimeRangeFilter;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.ExerciseSessionRecord;
import android.health.connect.datatypes.ExerciseSessionType;
import android.health.connect.datatypes.HeartRateRecord;
import android.health.connect.datatypes.Record;
import android.health.connect.datatypes.RestingHeartRateRecord;
import android.health.connect.datatypes.SleepSessionRecord;
import android.health.connect.datatypes.StepsRecord;
import android.health.connect.datatypes.WeightRecord;
import android.os.OutcomeReceiver;
import androidx.annotation.RequiresApi;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Lot 18 : Nestor lit la santé dans Health Connect (Android 14 et plus) : la montre Garmin et la balance Withings y écrivent.
 * Lecture seule, dans le téléphone. Rien n'est envoyé d'ici : la page calcule le brief et les résumés elle-même.
 */
@RequiresApi(34)
final class Sante {

    /** ce que Nestor demande à lire, et rien d'autre (l'historique : pour le poids sur plusieurs mois) */
    static final String[] PERMS = {
        "android.permission.health.READ_SLEEP",
        "android.permission.health.READ_STEPS",
        "android.permission.health.READ_HEART_RATE",
        "android.permission.health.READ_RESTING_HEART_RATE",
        "android.permission.health.READ_EXERCISE",
        "android.permission.health.READ_WEIGHT",
        "android.permission.health.READ_HEALTH_DATA_HISTORY"
    };

    private static final Executor DIRECT = Runnable::run;

    private Sante() {}

    static boolean dispo(Context ctx) {
        try {
            return ctx.getSystemService(HealthConnectManager.class) != null;
        } catch (Throwable t) {
            return false;
        }
    }

    /** autorisations accordées, en nom court : SLEEP, STEPS, HEART_RATE… */
    static JSONArray accordees(Context ctx) {
        JSONArray a = new JSONArray();
        for (String p : PERMS) if (ctx.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED) a.put(p.substring(p.lastIndexOf('.') + 1).replace("READ_", ""));
        return a;
    }

    private interface Appel<T> {
        void lancer(OutcomeReceiver<T, HealthConnectException> cb);
    }

    private static <T> T attendre(Appel<T> a) throws Exception {
        CompletableFuture<T> f = new CompletableFuture<>();
        a.lancer(
            new OutcomeReceiver<T, HealthConnectException>() {
                @Override
                public void onResult(T r) {
                    f.complete(r);
                }

                @Override
                public void onError(HealthConnectException e) {
                    f.completeExceptionally(e);
                }
            }
        );
        return f.get(25, TimeUnit.SECONDS);
    }

    private static TimeInstantRangeFilter entre(Instant a, Instant b) {
        return new TimeInstantRangeFilter.Builder().setStartTime(a).setEndTime(b).build();
    }

    private static <T extends Record> List<T> lireTout(HealthConnectManager hc, Class<T> type, Instant a, Instant b) throws Exception {
        List<T> out = new ArrayList<>();
        long jeton = -1;
        for (int page = 0; page < 30; page++) {
            ReadRecordsRequestUsingFilters.Builder<T> bld = new ReadRecordsRequestUsingFilters.Builder<>(type).setTimeRangeFilter(entre(a, b)).setPageSize(1000);
            if (jeton != -1) bld.setPageToken(jeton);
            final ReadRecordsRequestUsingFilters<T> req = bld.build();
            ReadRecordsResponse<T> r = Sante.<ReadRecordsResponse<T>>attendre(cb -> hc.readRecords(req, DIRECT, cb));
            out.addAll(r.getRecords());
            jeton = r.getNextPageToken();
            if (jeton == -1) break;
        }
        return out;
    }

    private static Long agreger(HealthConnectManager hc, Instant a, Instant b, android.health.connect.datatypes.AggregationType<Long> quoi) throws Exception {
        final AggregateRecordsRequest<Long> req = new AggregateRecordsRequest.Builder<Long>(entre(a, b)).addAggregationType(quoi).build();
        AggregateRecordsResponse<Long> r = Sante.<AggregateRecordsResponse<Long>>attendre(cb -> hc.aggregate(req, DIRECT, cb));
        return r.get(quoi);
    }

    private static String source(Record r) {
        try {
            return r.getMetadata().getDataOrigin().getPackageName();
        } catch (Throwable t) {
            return "";
        }
    }

    private static String raison(Exception e) {
        Throwable c = e.getCause() != null ? e.getCause() : e;
        if (c instanceof SecurityException) return "refus";
        if (c instanceof HealthConnectException && ((HealthConnectException) c).getErrorCode() == HealthConnectException.ERROR_SECURITY) return "refus";
        return "erreur";
    }

    /** jours = la période à lire (jusqu'à aujourd'hui) */
    static JSONObject lire(Context ctx, int jours) throws Exception {
        HealthConnectManager hc = ctx.getSystemService(HealthConnectManager.class);
        if (hc == null) throw new IllegalStateException("health connect absent");
        Instant fin = Instant.now(), debut = fin.minus(Duration.ofDays(jours + 1));
        JSONObject out = new JSONObject();
        JSONObject manque = new JSONObject();

        // sommeil : chaque session, avec ses phases et le pouls pendant les longues nuits
        JSONArray nuits = new JSONArray();
        try {
            List<SleepSessionRecord> L = lireTout(hc, SleepSessionRecord.class, debut, fin);
            int n = 0;
            for (int i = L.size() - 1; i >= 0 && n < Math.max(60, jours + 10); i--, n++) {
                SleepSessionRecord s = L.get(i);
                JSONObject o = new JSONObject();
                long a = s.getStartTime().toEpochMilli(), b = s.getEndTime().toEpochMilli();
                o.put("debut", a).put("fin", b).put("src", source(s));
                double profond = 0, paradoxal = 0, leger = 0, dort = 0, eveil = 0;
                int eveils = 0, prec = -1;
                for (SleepSessionRecord.Stage st : s.getStages()) {
                    double m = Duration.between(st.getStartTime(), st.getEndTime()).toMillis() / 60000.0;
                    int t = st.getType();
                    if (t == SleepSessionRecord.StageType.STAGE_TYPE_SLEEPING_DEEP) profond += m;
                    else if (t == SleepSessionRecord.StageType.STAGE_TYPE_SLEEPING_REM) paradoxal += m;
                    else if (t == SleepSessionRecord.StageType.STAGE_TYPE_SLEEPING_LIGHT) leger += m;
                    else if (t == SleepSessionRecord.StageType.STAGE_TYPE_SLEEPING) dort += m;
                    else if (t == SleepSessionRecord.StageType.STAGE_TYPE_AWAKE || t == SleepSessionRecord.StageType.STAGE_TYPE_AWAKE_IN_BED || t == SleepSessionRecord.StageType.STAGE_TYPE_AWAKE_OUT_OF_BED) {
                        eveil += m;
                        if (!isEveil(prec)) eveils++;
                    }
                    prec = t;
                }
                o.put("profond", Math.round(profond)).put("paradoxal", Math.round(paradoxal)).put("leger", Math.round(leger)).put("dort", Math.round(dort)).put("eveil", Math.round(eveil)).put("eveils", eveils);
                if (b - a >= 3 * 3600_000L) {
                    try {
                        Long moy = agreger(hc, s.getStartTime(), s.getEndTime(), HeartRateRecord.BPM_AVG);
                        Long min = agreger(hc, s.getStartTime(), s.getEndTime(), HeartRateRecord.BPM_MIN);
                        if (moy != null) o.put("fcMoy", moy);
                        if (min != null) o.put("fcMin", min);
                    } catch (Exception e) {
                        manque.put("pouls", raison(e));
                    }
                }
                nuits.put(o);
            }
        } catch (Exception e) {
            manque.put("sommeil", raison(e));
        }
        out.put("nuits", nuits);

        // pas : un total par jour (Health Connect retire les doublons téléphone + montre)
        JSONArray pas = new JSONArray();
        try {
            LocalDateTime a = LocalDate.now().minusDays(jours - 1).atStartOfDay(), b = LocalDateTime.now();
            final AggregateRecordsRequest<Long> req = new AggregateRecordsRequest.Builder<Long>(new LocalTimeRangeFilter.Builder().setStartTime(a).setEndTime(b).build())
                .addAggregationType(StepsRecord.STEPS_COUNT_TOTAL)
                .build();
            List<AggregateRecordsGroupedByPeriodResponse<Long>> L = Sante.<List<AggregateRecordsGroupedByPeriodResponse<Long>>>attendre(cb ->
                hc.aggregateGroupByPeriod(req, Period.ofDays(1), DIRECT, cb)
            );
            for (AggregateRecordsGroupedByPeriodResponse<Long> g : L) {
                Long v = g.get(StepsRecord.STEPS_COUNT_TOTAL);
                if (v != null) pas.put(new JSONObject().put("d", g.getStartTime().toLocalDate().toString()).put("n", v));
            }
        } catch (Exception e) {
            manque.put("pas", raison(e));
        }
        out.put("pas", pas);

        // pouls au repos, s'il est écrit (sinon la page prend le pouls moyen des nuits)
        JSONArray repos = new JSONArray();
        try {
            for (RestingHeartRateRecord r : lireTout(hc, RestingHeartRateRecord.class, debut, fin)) repos.put(new JSONObject().put("t", r.getTime().toEpochMilli()).put("bpm", r.getBeatsPerMinute()).put("src", source(r)));
        } catch (Exception e) {
            manque.put("repos", raison(e));
        }
        out.put("repos", repos);

        // poids
        JSONArray poids = new JSONArray();
        try {
            for (WeightRecord r : lireTout(hc, WeightRecord.class, debut, fin)) poids.put(new JSONObject().put("t", r.getTime().toEpochMilli()).put("kg", Math.round(r.getWeight().getInGrams() / 10.0) / 100.0).put("src", source(r)));
        } catch (Exception e) {
            manque.put("poids", raison(e));
        }
        out.put("poids", poids);

        // séances de sport
        JSONArray seances = new JSONArray();
        try {
            for (ExerciseSessionRecord r : lireTout(hc, ExerciseSessionRecord.class, debut, fin)) {
                CharSequence titre = r.getTitle();
                seances.put(
                    new JSONObject()
                        .put("debut", r.getStartTime().toEpochMilli())
                        .put("fin", r.getEndTime().toEpochMilli())
                        .put("type", sport(r.getExerciseType()))
                        .put("titre", titre != null ? titre.toString() : "")
                        .put("src", source(r))
                );
            }
        } catch (Exception e) {
            manque.put("seances", raison(e));
        }
        out.put("seances", seances);

        out.put("manque", manque);
        out.put("perms", accordees(ctx));
        return out;
    }

    private static boolean isEveil(int t) {
        return t == SleepSessionRecord.StageType.STAGE_TYPE_AWAKE || t == SleepSessionRecord.StageType.STAGE_TYPE_AWAKE_IN_BED || t == SleepSessionRecord.StageType.STAGE_TYPE_AWAKE_OUT_OF_BED;
    }

    private static String sport(int t) {
        switch (t) {
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_GOLF: return "golf";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_WALKING: return "marche";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_HIKING: return "randonnée";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_RUNNING:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_RUNNING_TREADMILL: return "course";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_BIKING:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_BIKING_STATIONARY: return "vélo";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_SWIMMING_POOL:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_SWIMMING_OPEN_WATER: return "natation";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_STRENGTH_TRAINING:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_WEIGHTLIFTING:
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_CALISTHENICS: return "renforcement";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING: return "fractionné";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_ELLIPTICAL: return "elliptique";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_ROWING_MACHINE: return "rameur";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_YOGA: return "yoga";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_PILATES: return "pilates";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_STRETCHING: return "étirements";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_TENNIS: return "tennis";
            case ExerciseSessionType.EXERCISE_SESSION_TYPE_STAIR_CLIMBING: return "escaliers";
            default: return "séance";
        }
    }
}
