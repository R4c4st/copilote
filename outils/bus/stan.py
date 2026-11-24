"""Horaires du réseau Stan (Grand Nancy) -> donnees/stan.json, compact, lu par Jarvis dans le téléphone.

Source : Réseau Stan / Métropole du Grand Nancy, données ouvertes (Licence Ouverte Etalab),
publiées sur transport.data.gouv.fr. Données publiques : aucune information personnelle ici.
"""
import csv, io, json, os, re, sys, urllib.request, zipfile
from datetime import date, datetime, timedelta

DATASET = "https://transport.data.gouv.fr/api/datasets/fr-200052264-t0034-0000-1"
PAGE = "https://transport.data.gouv.fr/datasets/fr-200052264-t0034-0000-1"
SECOURS = "https://transport.data.gouv.fr/resources/83710/download"
JOURS = 120  # jours de calendrier précalculés


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "copilote-horaires/1 (github.com/R4c4st/copilote)"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def url_gtfs():
    try:
        d = json.loads(get(DATASET))
        res = [r for r in d.get("resources", []) if (r.get("format") or "").upper() == "GTFS" and r.get("url")]
        res.sort(key=lambda r: r.get("updated") or r.get("last_update") or "", reverse=True)
        if res:
            return res[0].get("url")
    except Exception as e:  # l'API change parfois : on lit la page du jeu de données
        print("API indisponible :", e, file=sys.stderr)
    try:
        html = get(PAGE).decode("utf-8", "replace")
        ids = re.findall(r'/resources/(\d+)[^"]*"[^<]{0,400}GTFS', html) or re.findall(r'/resources/(\d+)', html)
        if ids:
            return f"https://transport.data.gouv.fr/resources/{max(ids, key=int)}/download"
    except Exception as e:
        print("page indisponible :", e, file=sys.stderr)
    return SECOURS


def lire(z, nom):
    with z.open(nom) as f:
        return list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig")))


def minutes(t):
    h, m, *_ = (t or "0:0").split(":")
    return int(h) * 60 + int(m)


def main(sortie):
    url = url_gtfs()
    print("GTFS :", url)
    z = zipfile.ZipFile(io.BytesIO(get(url)))

    stops = {s["stop_id"]: s for s in lire(z, "stops.txt")}
    routes = {r["route_id"]: r for r in lire(z, "routes.txt")}
    trips = {t["trip_id"]: t for t in lire(z, "trips.txt")}
    st = {}
    for r in lire(z, "stop_times.txt"):
        st.setdefault(r["trip_id"], []).append((int(r["stop_sequence"]), r["stop_id"], r.get("departure_time") or r.get("arrival_time")))

    # calendrier : quels services roulent chaque jour
    actifs = {}
    debut = date.today() - timedelta(days=1)
    jours = [debut + timedelta(days=i) for i in range(JOURS)]
    noms_j = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    if "calendar.txt" in z.namelist():
        for c in lire(z, "calendar.txt"):
            a, b = datetime.strptime(c["start_date"], "%Y%m%d").date(), datetime.strptime(c["end_date"], "%Y%m%d").date()
            for j in jours:
                if a <= j <= b and c.get(noms_j[j.weekday()]) == "1":
                    actifs.setdefault(j, set()).add(c["service_id"])
    if "calendar_dates.txt" in z.namelist():
        for c in lire(z, "calendar_dates.txt"):
            j = datetime.strptime(c["date"], "%Y%m%d").date()
            if j not in jours:
                continue
            if c["exception_type"] == "1":
                actifs.setdefault(j, set()).add(c["service_id"])
            elif c["exception_type"] == "2":
                actifs.setdefault(j, set()).discard(c["service_id"])

    idx_arret, arrets = {}, []
    idx_ligne, lignes = {}, []
    idx_svc, svcs = {}, []
    idx_dir, dirs = {}, []
    idx_parc, parcours = {}, []
    courses = []

    def ix(table, liste, cle, valeur):
        if cle not in table:
            table[cle] = len(liste)
            liste.append(valeur)
        return table[cle]

    for tid, seq in st.items():
        t = trips.get(tid)
        if not t:
            continue
        seq.sort()
        ids = []
        for _, sid, _ in seq:
            s = stops.get(sid, {})
            ids.append(ix(idx_arret, arrets, sid, [s.get("stop_name", sid).strip(), round(float(s.get("stop_lat") or 0), 5), round(float(s.get("stop_lon") or 0), 5)]))
        r = routes.get(t["route_id"], {})
        li = ix(idx_ligne, lignes, t["route_id"], [r.get("route_short_name") or r.get("route_long_name") or "?", r.get("route_long_name") or "", r.get("route_color") or ""])
        sv = ix(idx_svc, svcs, t["service_id"], t["service_id"])
        di = ix(idx_dir, dirs, (t.get("trip_headsign") or "").strip(), (t.get("trip_headsign") or "").strip())
        pa = ix(idx_parc, parcours, tuple(ids), ids)
        tm = [minutes(x) for _, _, x in seq]
        courses.append([li, sv, pa, di, tm[0]] + [b - a for a, b in zip(tm, tm[1:])])

    courses.sort(key=lambda c: (c[0], c[4]))
    jours_out = {j.isoformat(): sorted(idx_svc[s] for s in actifs.get(j, set()) if s in idx_svc) for j in jours}
    out = {
        "v": 1,
        "source": "Réseau Stan / Métropole du Grand Nancy — données ouvertes, Licence Ouverte (transport.data.gouv.fr)",
        "maj": date.today().isoformat(),
        "arrets": arrets, "lignes": lignes, "directions": dirs, "parcours": parcours,
        "jours": jours_out, "courses": courses,
    }
    os.makedirs(os.path.dirname(sortie) or ".", exist_ok=True)
    with open(sortie, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(arrets)} arrêts, {len(lignes)} lignes, {len(parcours)} parcours, {len(courses)} courses, jours actifs : {sum(1 for v in jours_out.values() if v)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "donnees/stan.json")
