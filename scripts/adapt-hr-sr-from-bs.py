#!/usr/bin/env python3
"""One-shot: derive messages/hr.json and messages/sr.json from messages/bs.json.

HR = ijekavian Croatian wording; SR = Serbian Latin ekavian.
Public prices in both catalogs use EUR (not KM). Run from repo root.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BS_PATH = ROOT / "messages" / "bs.json"

# Longer / more specific phrases first.
HR_PHRASES: list[tuple[str, str]] = [
    ("Šta se dešava", "Što se događa"),
    ("šta se dešava", "što se događa"),
    ("Šta znači", "Što znači"),
    ("šta znači", "što znači"),
    ("Šta ako", "Što ako"),
    ("šta ako", "što ako"),
    ("Šta je uključeno", "Što je uključeno"),
    ("Šta je", "Što je"),
    ("šta je urađeno, a šta", "što je obavljeno, a što"),
    ("šta je", "što je"),
    ("Šta slijedi", "Što slijedi"),
    ("šta slijedi", "što slijedi"),
    ("šta vide", "što vide"),
    ("šta očekivati", "što očekivati"),
    ("ko je šta", "tko je što"),
    ("Niko ne zna ko", "Nitko ne zna tko"),
    ("niko ne zna ko", "nitko ne zna tko"),
    ("Otvori meni", "Otvori izbornik"),
    ("Zatvori meni", "Zatvori izbornik"),
    ("otvorite meni", "otvorite izbornik"),
    ("Otvorite meni", "Otvorite izbornik"),
    ("Chrome meni", "Chromeov izbornik"),
    ("Share meni", "Share izbornik"),
    ("Start meni", "izbornik Start"),
    ("Saglasan/na sam", "Slažem se"),
    ("Uslovi korištenja", "Uvjeti korištenja"),
    ("Puni uslovi", "Puni uvjeti"),
    ("CSV fajla", "CSV datoteke"),
    ("CSV fajl", "CSV datoteka"),
    ("isti fajl", "ista datoteka"),
    ("Fajl je prazan", "Datoteka je prazna"),
    ("Koristi CSV fajl", "Koristi CSV datoteku"),
    ("po fajlu", "po datoteci"),
    ("PDF fajl", "PDF datoteka"),
    ("Fajl mora biti slika", "Datoteka mora biti slika"),
    ("binarne fajlove", "binarne datoteke"),
    ("Brisanje fajlova", "Brisanje datoteka"),
    ("tri tačke", "tri točke"),
    ("email je već registrovan", "email je već registriran"),
    ("Email je već registrovan", "Email je već registriran"),
    ("konačno organizovana", "konačno organizirana"),
]

HR_WORDS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bNiko\b"), "Nitko"),
    (re.compile(r"\bniko\b"), "nitko"),
    (re.compile(r"\bŠta\b"), "Što"),
    (re.compile(r"\bšta\b"), "što"),
    (re.compile(r"\bko\b"), "tko"),
    (re.compile(r"\buslovi\b"), "uvjeti"),
    (re.compile(r"\bUslovi\b"), "Uvjeti"),
    (re.compile(r"\bsaglasnosti\b"), "suglasnosti"),
    (re.compile(r"\bSaglasnosti\b"), "Suglasnosti"),
    (re.compile(r"\bsaglasnost\b"), "suglasnost"),
    (re.compile(r"\bSaglasnost\b"), "Suglasnost"),
    (re.compile(r"\bcjenovnik\b"), "cjenik"),
    (re.compile(r"\bCjenovnik\b"), "Cjenik"),
    (re.compile(r"\bcjenovnika\b"), "cjenika"),
    (re.compile(r"\bCjenovnika\b"), "Cjenika"),
    (re.compile(r"\bfajlove\b"), "datoteke"),
    (re.compile(r"\bfajlova\b"), "datoteka"),
    (re.compile(r"\bfajlu\b"), "datoteci"),
    (re.compile(r"\bfajla\b"), "datoteke"),
    (re.compile(r"\bFajl\b"), "Datoteka"),
    (re.compile(r"\bfajl\b"), "datoteka"),
    (re.compile(r"\bSačuvaj\b"), "Spremi"),
    (re.compile(r"\bsačuvaj\b"), "spremi"),
    (re.compile(r"\bSačuvano\b"), "Spremljeno"),
    (re.compile(r"\bsačuvano\b"), "spremljeno"),
    (re.compile(r"\bsačuvane\b"), "spremljene"),
    (re.compile(r"\bsačuvana\b"), "spremljena"),
    (re.compile(r"\bkaraktera\b"), "znakova"),
    (re.compile(r"\bkaraktere\b"), "znakove"),
    (re.compile(r"\btačke\b"), "točke"),
    (re.compile(r"\btačka\b"), "točka"),
    (re.compile(r"\bhistorija\b"), "povijest"),
    (re.compile(r"\bHistorija\b"), "Povijest"),
]

# Exact-string keys that are the UI word "Meni" (not dative "meni" = to me).
HR_EXACT = {
    "Meni": "Izbornik",
}

SR_PHRASES: list[tuple[str, str]] = [
    ("poslijepodne", "poslepodne"),
    ("Poslijepodne", "Poslepodne"),
    ("prijepodne", "prepodne"),
    ("Prijepodne", "Prepodne"),
]

SR_WORDS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"osvjež"), "osvež"),
    (re.compile(r"Osvjež"), "Osvež"),
    (re.compile(r"izvješt"), "izvešt"),
    (re.compile(r"Izvješt"), "Izvešt"),
    (re.compile(r"mjesečn"), "mesečn"),
    (re.compile(r"Mjesečn"), "Mesečn"),
    (re.compile(r"cjenovnik"), "cenovnik"),
    (re.compile(r"Cjenovnik"), "Cenovnik"),
    (re.compile(r"djelomičn"), "delimičn"),
    (re.compile(r"Djelomičn"), "Delimičn"),
    (re.compile(r"djelimičn"), "delimičn"),
    (re.compile(r"Djelimičn"), "Delimičn"),
    (re.compile(r"dosljed"), "dosled"),
    (re.compile(r"Dosljed"), "Dosled"),
    (re.compile(r"podijel"), "podel"),
    (re.compile(r"svidjel"), "svidel"),
    (re.compile(r"Svidjel"), "Svidel"),
    (re.compile(r"historij"), "istorij"),
    (re.compile(r"Historij"), "Istorij"),
    (re.compile(r"dodjelj"), "dodelj"),
    (re.compile(r"neuspjel"), "neuspel"),
    (re.compile(r"Neuspjel"), "Neuspel"),
    (re.compile(r"mjesec"), "mesec"),
    (re.compile(r"Mjesec"), "Mesec"),
    (re.compile(r"\bumjesto\b"), "umesto"),
    (re.compile(r"\bUmjesto\b"), "Umesto"),
    (re.compile(r"\bmjestu\b"), "mestu"),
    (re.compile(r"\bmjesto\b"), "mesto"),
    (re.compile(r"\buspjelo\b"), "uspelo"),
    (re.compile(r"\buspjela\b"), "uspela"),
    (re.compile(r"\bposlije\b"), "posle"),
    (re.compile(r"\bPoslije\b"), "Posle"),
    (re.compile(r"\bmjesečno\b"), "mesečno"),
    (re.compile(r"\bMjesečno\b"), "Mesečno"),
    (re.compile(r"\bmjeseci\b"), "meseci"),
    (re.compile(r"\bmjeseca\b"), "meseca"),
    (re.compile(r"\bmjesec\b"), "mesec"),
    (re.compile(r"\bMjesec\b"), "Mesec"),
    (re.compile(r"\bvremena\b"), "vremena"),
    (re.compile(r"\bvrijeme\b"), "vreme"),
    (re.compile(r"\bVrijeme\b"), "Vreme"),
    (re.compile(r"\bcjenovnika\b"), "cenovnika"),
    (re.compile(r"\bCjenovnika\b"), "Cenovnika"),
    (re.compile(r"\bcjenovnik\b"), "cenovnik"),
    (re.compile(r"\bCjenovnik\b"), "Cenovnik"),
    (re.compile(r"\bprocjena\b"), "procena"),
    (re.compile(r"\bProcjena\b"), "Procena"),
    (re.compile(r"\bprocjene\b"), "procene"),
    (re.compile(r"\bcijenama\b"), "cenama"),
    (re.compile(r"\bcijenom\b"), "cenom"),
    (re.compile(r"\bcijene\b"), "cene"),
    (re.compile(r"\bCijene\b"), "Cene"),
    (re.compile(r"\bcijena\b"), "cena"),
    (re.compile(r"\bCijena\b"), "Cena"),
    (re.compile(r"\bsljedećeg\b"), "sledećeg"),
    (re.compile(r"\bsljedećem\b"), "sledećem"),
    (re.compile(r"\bsljedeći\b"), "sledeći"),
    (re.compile(r"\bSljedeći\b"), "Sledeći"),
    (re.compile(r"\bsljedeća\b"), "sledeća"),
    (re.compile(r"\bSljedeća\b"), "Sledeća"),
    (re.compile(r"\bsljedeće\b"), "sledeće"),
    (re.compile(r"\bSljedeće\b"), "Sledeće"),
    (re.compile(r"\bsljedeću\b"), "sledeću"),
    (re.compile(r"\bSljedeću\b"), "Sledeću"),
    (re.compile(r"\bObavijest\b"), "Obavest"),
    (re.compile(r"\bObavijesti\b"), "Obavesti"),
    (re.compile(r"\bslijedi\b"), "sledi"),
    (re.compile(r"\bSlijedi\b"), "Sledi"),
    (re.compile(r"\bredoslijed\b"), "redosled"),
    (re.compile(r"\bRedoslijed\b"), "Redosled"),
    (re.compile(r"\buspješno\b"), "uspešno"),
    (re.compile(r"\bUspješno\b"), "Uspešno"),
    (re.compile(r"\buspjeh\b"), "uspeh"),
    (re.compile(r"\bprijevoda\b"), "prevoda"),
    (re.compile(r"\bprijevod\b"), "prevod"),
    (re.compile(r"\brješenje\b"), "rešenje"),
    (re.compile(r"\bRješenje\b"), "Rešenje"),
    (re.compile(r"\brješava\b"), "rešava"),
    (re.compile(r"\bizmjenom\b"), "izmenom"),
    (re.compile(r"\bizmjenu\b"), "izmenu"),
    (re.compile(r"\bizmjene\b"), "izmene"),
    (re.compile(r"\bIzmjene\b"), "Izmene"),
    (re.compile(r"\bizmjena\b"), "izmena"),
    (re.compile(r"\bIzmjena\b"), "Izmena"),
    (re.compile(r"\bobavještenje\b"), "obaveštenje"),
    (re.compile(r"\bobavijesti\b"), "obavesti"),
    (re.compile(r"\bobavijest\b"), "obavest"),
    (re.compile(r"\bdjelomično\b"), "delimično"),
    (re.compile(r"\bdjeluje\b"), "deluje"),
    (re.compile(r"\buvijek\b"), "uvek"),
    (re.compile(r"\bUvijek\b"), "Uvek"),
    (re.compile(r"\bgdje\b"), "gde"),
    (re.compile(r"\bGdje\b"), "Gde"),
    (re.compile(r"\bovdje\b"), "ovde"),
    (re.compile(r"\bOvdje\b"), "Ovde"),
    (re.compile(r"\bnedjelju\b"), "nedelju"),
    (re.compile(r"\bnedjelja\b"), "nedelja"),
    (re.compile(r"\bNedjelja\b"), "Nedelja"),
    (re.compile(r"\bsrijedu\b"), "sredu"),
    (re.compile(r"\bsrijeda\b"), "sreda"),
    (re.compile(r"\bSrijeda\b"), "Sreda"),
    (re.compile(r"\bponedjeljka\b"), "ponedeljka"),
    (re.compile(r"\bponedjeljak\b"), "ponedeljak"),
    (re.compile(r"\bPonedjeljak\b"), "Ponedeljak"),
    (re.compile(r"\bcijelim\b"), "celim"),
    (re.compile(r"\bcijelom\b"), "celom"),
    (re.compile(r"\bcijelog\b"), "celog"),
    (re.compile(r"\bcijelu\b"), "celu"),
    (re.compile(r"\bcijeli\b"), "celi"),
    (re.compile(r"\bCijeli\b"), "Celi"),
    (re.compile(r"\bprije\b"), "pre"),
    (re.compile(r"\bPrije\b"), "Pre"),
]


def apply_pairs(text: str, phrases: list[tuple[str, str]], words: list[tuple[re.Pattern[str], str]]) -> str:
    for old, new in phrases:
        text = text.replace(old, new)
    for pat, new in words:
        text = pat.sub(new, text)
    return text


def to_eur_copy(text: str) -> str:
    """BS marketing uses KM; HR/SR public copy uses EUR (same demo numbers, 2× for plan teaser)."""
    text = text.replace("od 30 KM mjesečno", "od 15 € mjesečno")
    text = text.replace("od 30 KM mesečno", "od 15 € mesečno")
    text = text.replace("Cijene u KM sa PDV-om", "Cijene u eurima s PDV-om")
    text = text.replace("Cene u KM sa PDV-om", "Cene u eurima s PDV-om")
    text = text.replace("Cijene u KM s PDV-om", "Cijene u eurima s PDV-om")
    text = text.replace("Cene u KM s PDV-om", "Cene u eurima s PDV-om")
    text = text.replace("fakturu u KM s PDV-om", "fakturu u eurima s PDV-om")
    text = text.replace("Fakture u KM sa PDV-om", "Fakture u eurima s PDV-om")
    text = text.replace("Fakture u KM s PDV-om", "Fakture u eurima s PDV-om")
    text = text.replace("s KM + PDV-om", "s EUR + PDV-om")
    text = text.replace("KM + PDV", "EUR + PDV")
    text = text.replace("u KM sa PDV-om", "u eurima s PDV-om")
    text = text.replace("u KM s PDV-om", "u eurima s PDV-om")
    text = re.sub(r"\b(\d+(?:[.,]\d+)?)\s*KM\b", r"\1 €", text)
    text = text.replace("jezik našeg regiona, KM + PDV", "jezik našeg regiona, EUR + PDV")
    return text


def walk(node, *, lang: str, path: str = ""):
    if isinstance(node, dict):
        return {k: walk(v, lang=lang, path=f"{path}.{k}" if path else k) for k, v in node.items()}
    if isinstance(node, list):
        return [walk(v, lang=lang, path=f"{path}[]") for v in node]
    if not isinstance(node, str):
        return node

    text = node
    if lang == "hr":
        if text in HR_EXACT:
            text = HR_EXACT[text]
        text = apply_pairs(text, HR_PHRASES, HR_WORDS)
    elif lang == "sr":
        text = apply_pairs(text, SR_PHRASES, SR_WORDS)
    text = to_eur_copy(text)
    return text


def dump(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    bs = json.loads(BS_PATH.read_text(encoding="utf-8"))
    hr = walk(bs, lang="hr")
    sr = walk(bs, lang="sr")
    dump(ROOT / "messages" / "hr.json", hr)
    dump(ROOT / "messages" / "sr.json", sr)
    print("wrote messages/hr.json and messages/sr.json")


if __name__ == "__main__":
    main()
