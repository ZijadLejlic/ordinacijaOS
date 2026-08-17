import type { LegalDocument } from "@/lib/legal/types";
import { EMAIL_SUPPORT, PRODUCT_NAME } from "@/lib/brand/constants";

/** Privacy Policy draft from PRD §13.1 — not a substitute for legal review. */
export const PRIVACY_LAST_UPDATED = "2026-07-14";

export function getPrivacyDocument(locale: string): LegalDocument {
  return locale === "en" ? privacyEn() : privacyBs();
}

function privacyBs(): LegalDocument {
  return {
    title: "Politika privatnosti",
    description:
      "Kako DentOrd obrađuje podatke ordinacija, korisnika i posjetilaca marketing stranice.",
    lastUpdated: PRIVACY_LAST_UPDATED,
    disclaimer:
      "Ovaj tekst je radni draft prilagođen DentOrd modelu (SaaS, EU). Nije zamjena za advokata. Prije produkcijskog naplatnog perioda (2027) slijedi pravna revizija.",
    sections: [
      {
        id: "ko-smo",
        title: "1. Ko smo (voditelj vs obradaitelj)",
        paragraphs: [
          `${PRODUCT_NAME} je cloud softver za vođenje stomatološke ordinacije. Operater platforme nastupa pod brendom ${PRODUCT_NAME} (domen dentord.com).`,
          "Kada stomatološka ordinacija (“Klinika”) unosi podatke o pacijentima u DentOrd, Klinika određuje svrhu i sredstva obrade tih podataka i djeluje kao voditelj obrade. DentOrd pruža softver i infrastrukturu i djeluje kao obradaitelj u skladu s Ugovorom o obradi podataka (DPA).",
          "Za podatke o korisničkim nalozima Klinike i podatke prikupljene na marketing stranici, DentOrd može djelovati kao voditelj obrade.",
        ],
      },
      {
        id: "podaci",
        title: "2. Koje podatke prikupljamo",
        paragraphs: [
          "Podaci naloga: ime, email, lozinka (hash), uloga, MFA status vlasnika.",
          "Podaci ordinacije: naziv, kontakt, adresa, radno vrijeme, branding, cjenovnik.",
          "Podaci pacijenata koje unese Klinika: identifikacioni i kontakt podaci, zdravstvena evidencija, termini, fakture, dokumenti — Klinika je voditelj obrade tih podataka.",
          "Usage analytics i cookies: događaji korištenja funkcija (bez imena pacijenata), te neophodni i — uz pristanak — analitički kolačići na marketing siteu.",
          "Marketing leadovi: ime, naziv ordinacije, telefon, email i poruka koje dobrovoljno pošaljete putem kontakt forme.",
        ],
      },
      {
        id: "pravni-osnovi",
        title: "3. Pravni osnovi",
        paragraphs: [
          "Izvršenje ugovora — pružanje DentOrd usluge Klinici i korisničkim nalozima.",
          "Legitimni interes — sigurnost platforme, sprječavanje zloupotrebe, poboljšanje proizvoda (uz ograničenja iz §2).",
          "Pristanak — analitički cookies i marketinški kontakti gdje je to zakonski potrebno.",
        ],
      },
      {
        id: "uloga-klinike",
        title: "4. Uloga klinike",
        paragraphs: [
          "Klinika je voditelj obrade za podatke pacijenata. DentOrd je obradaitelj i obrađuje te podatke isključivo radi pružanja usluge i po uputama Klinike (uključujući konfiguraciju u aplikaciji).",
          "Klinika je odgovorna da ima pravni osnov za unos i obradu zdravstvenih podataka pacijenata u DentOrdu.",
        ],
      },
      {
        id: "lokacija",
        title: "5. Čuvanje i lokacija",
        paragraphs: [
          "Primarna infrastruktura baza podataka i storage-a nalazi se u EU (Supabase EU). Cilj je da podaci pacijenata ostanu u Evropskoj ekonomskoj zoni.",
        ],
      },
      {
        id: "djelioci",
        title: "6. Djelioci (podobradaitelji)",
        paragraphs: [
          "Koristimo pouzdane pružatelje usluga: Supabase (baza, auth, storage), Vercel (hosting aplikacije), Resend (email), Sentry (greške aplikacije), PostHog (produkt analitika — bez imena pacijenata), te Lemon Squeezy za naplatu pretplate karticom od 2027. Ako klinika plaća virmanom, podaci o plaćanju ne prolaze kroz vanjskog pružatelja naplate.",
          "Svaki djelilac obrađuje podatke samo u mjeri potrebnoj za svoju uslugu i pod odgovarajućim ugovornim zaštitama.",
        ],
      },
      {
        id: "rokovi",
        title: "7. Periodi čuvanja",
        paragraphs: [
          "Tokom aktivne pretplate ili besplatnog perioda do 31.12.2026. podaci Klinike čuvaju se dok je nalog aktivan.",
          "Nakon isteka plaćenog ili besplatnog perioda: režim samo-za-čitanje do 7 dana, mogućnost izvoza, zatim trajno brisanje u skladu s politikom čuvanja.",
          "AI transcripti (kad funkcija bude dostupna): orijentir 90 dana, osim ako Klinika ne zatraži drugačije u skladu s DPA.",
          "Marketing leadovi: dok je potreban kontakt radi upita, ili dok ne zatražite brisanje.",
        ],
      },
      {
        id: "prava",
        title: "8. Prava ispitanika",
        paragraphs: [
          "U zavisnosti od uloge (korisnik Klinike vs pacijent), možete imati pravo na pristup, ispravku, brisanje, prenosivost i prigovor.",
          "Pacijenti svoje zahtjeve u pravilu upućuju Klinici kao voditelju obrade. DentOrd pomaže Klinici kroz alate za export i brisanje (GDPR tok u aplikaciji).",
          `Zahtjeve vezane za DentOrd kao voditelja (nalozi, marketing) šaljite na ${EMAIL_SUPPORT}.`,
        ],
      },
      {
        id: "sigurnost",
        title: "9. Sigurnost",
        paragraphs: [
          "Šifrovanje u tranzitu (TLS), izolacija klinika putem Row Level Security, kontrola pristupa po ulogama, MFA za vlasnika, dnevni backup i audit trag ključnih radnji.",
        ],
      },
      {
        id: "djeca",
        title: "10. Djeca / maloljetnici",
        paragraphs: [
          "DentOrd nije usmjeren na djecu kao korisnike. Podaci o maloljetnim pacijentima unose se isključivo preko Klinike u okviru zdravstvene evidencije.",
        ],
      },
      {
        id: "analytics",
        title: "11. Analitika",
        paragraphs: [
          "Koristimo alate za analitiku proizvoda kako bismo razumjeli korištenje funkcija. Ne šaljemo imena i prezimena pacijenata u analytics alate. Identifikatori događaja vezani su za kliniku i ulogu korisnika, ne za identitet pacijenta.",
          "Na marketing siteu PostHog, Vercel Web Analytics i Speed Insights učitavaju se tek nakon što prihvatite analitičke kolačiće. ID-evi pacijenata u URL-ovima se redactaju prije slanja događaja.",
        ],
      },
      {
        id: "kontakt",
        title: "12. Kontakt za privacy zahtjeve",
        paragraphs: [
          `Email: ${EMAIL_SUPPORT}. Odgovaramo u razumnom roku, u skladu s primjenjivim propisima.`,
        ],
      },
      {
        id: "izmjene",
        title: "13. Izmjene politike",
        paragraphs: [
          "Politiku možemo ažurirati. Datum zadnje izmjene prikazan je na vrhu stranice. Bitne izmjene ćemo istaknuti na siteu ili obavijestiti vlasnike naloga gdje je to primjereno.",
        ],
      },
    ],
  };
}

function privacyEn(): LegalDocument {
  return {
    title: "Privacy Policy",
    description:
      "How DentOrd processes data of clinics, users, and marketing site visitors.",
    lastUpdated: PRIVACY_LAST_UPDATED,
    disclaimer:
      "This text is a working draft tailored to the DentOrd model (SaaS, EU). It is not a substitute for legal advice. A legal review is required before paid production (2027).",
    sections: [
      {
        id: "who-we-are",
        title: "1. Who we are (controller vs processor)",
        paragraphs: [
          `${PRODUCT_NAME} is cloud software for running a dental clinic. The platform operator trades under the ${PRODUCT_NAME} brand (dentord.com).`,
          "When a dental clinic (“Clinic”) enters patient data into DentOrd, the Clinic determines the purposes and means of that processing and acts as controller. DentOrd provides software and infrastructure and acts as processor under the Data Processing Agreement (DPA).",
          "For Clinic account data and data collected on the marketing site, DentOrd may act as controller.",
        ],
      },
      {
        id: "data",
        title: "2. Data we collect",
        paragraphs: [
          "Account data: name, email, password (hash), role, owner MFA status.",
          "Clinic data: name, contact details, address, hours, branding, fee schedule.",
          "Patient data entered by the Clinic: identity and contact details, clinical records, appointments, invoices, documents — the Clinic is controller of that data.",
          "Usage analytics and cookies: feature-usage events (no patient names), plus essential and — with consent — analytics cookies on the marketing site.",
          "Marketing leads: name, clinic name, phone, email and message you voluntarily submit via the contact form.",
        ],
      },
      {
        id: "legal-bases",
        title: "3. Legal bases",
        paragraphs: [
          "Contract performance — providing the DentOrd service to the Clinic and user accounts.",
          "Legitimate interest — platform security, abuse prevention, product improvement (subject to the limits in §2).",
          "Consent — analytics cookies and marketing contacts where legally required.",
        ],
      },
      {
        id: "clinic-role",
        title: "4. Clinic role",
        paragraphs: [
          "The Clinic is controller for patient data. DentOrd is processor and processes that data solely to provide the service and on the Clinic’s instructions (including in-app configuration).",
          "The Clinic is responsible for having a lawful basis to enter and process patient health data in DentOrd.",
        ],
      },
      {
        id: "location",
        title: "5. Storage and location",
        paragraphs: [
          "Primary database and storage infrastructure is in the EU (Supabase EU). The goal is to keep patient data within the European Economic Area.",
        ],
      },
      {
        id: "processors",
        title: "6. Recipients (sub-processors)",
        paragraphs: [
          "We use trusted providers: Supabase (database, auth, storage), Vercel (app hosting), Resend (email), Sentry (application errors), PostHog (product analytics — no patient names), and Lemon Squeezy for card subscription billing from 2027. If a clinic pays by bank transfer, no external billing provider is involved.",
          "Each recipient processes data only as needed for its service under appropriate contractual safeguards.",
        ],
      },
      {
        id: "retention",
        title: "7. Retention",
        paragraphs: [
          "During an active subscription or the free period until 31 Dec 2026, Clinic data is retained while the account is active.",
          "After a paid or free period ends: read-only mode for up to 7 days, export opportunity, then permanent deletion per retention policy.",
          "AI transcripts (when available): indicative 90 days unless the Clinic requests otherwise under the DPA.",
          "Marketing leads: while needed to handle the enquiry, or until you request deletion.",
        ],
      },
      {
        id: "rights",
        title: "8. Data subject rights",
        paragraphs: [
          "Depending on your role (Clinic user vs patient), you may have rights of access, rectification, erasure, portability and objection.",
          "Patients should generally contact the Clinic as controller. DentOrd helps Clinics via export and deletion tools (in-app GDPR flow).",
          `Requests where DentOrd is controller (accounts, marketing) go to ${EMAIL_SUPPORT}.`,
        ],
      },
      {
        id: "security",
        title: "9. Security",
        paragraphs: [
          "Encryption in transit (TLS), clinic isolation via Row Level Security, role-based access, owner MFA, daily backups and an audit trail of key actions.",
        ],
      },
      {
        id: "children",
        title: "10. Children / minors",
        paragraphs: [
          "DentOrd is not directed at children as users. Data about minor patients is entered only by the Clinic as clinical records.",
        ],
      },
      {
        id: "analytics",
        title: "11. Analytics",
        paragraphs: [
          "We use product analytics to understand feature usage. We do not send patient first or last names to analytics tools. Event identifiers relate to clinic and user role, not patient identity.",
          "On the marketing site, PostHog, Vercel Web Analytics, and Speed Insights load only after you accept analytics cookies. Patient IDs in URLs are redacted before events are sent.",
        ],
      },
      {
        id: "contact",
        title: "12. Privacy contact",
        paragraphs: [
          `Email: ${EMAIL_SUPPORT}. We respond within a reasonable time under applicable law.`,
        ],
      },
      {
        id: "changes",
        title: "13. Policy changes",
        paragraphs: [
          "We may update this policy. The last-updated date appears at the top of the page. Material changes will be highlighted on the site or communicated to account owners where appropriate.",
        ],
      },
    ],
  };
}
