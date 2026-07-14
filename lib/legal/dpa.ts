import type { LegalDocument } from "@/lib/legal/types";
import { EMAIL_SUPPORT, PRODUCT_NAME } from "@/lib/brand/constants";

/** DPA draft from PRD §13.3 — Clinic (Controller) ↔ DentOrd (Processor). */
export const DPA_LAST_UPDATED = "2026-07-14";

export function getDpaDocument(locale: string): LegalDocument {
  return locale === "en" ? dpaEn() : dpaBs();
}

function dpaBs(): LegalDocument {
  return {
    title: "Ugovor o obradi podataka (DPA)",
    description:
      "Ugovor o obradi podataka između Klinike (voditelj) i DentOrda (obradaitelj).",
    lastUpdated: DPA_LAST_UPDATED,
    disclaimer:
      "Radni draft DPA-a. Prije naplate 2027. potrebna pravna revizija. Prihvata se kroz Terms pri signup-u (clickwrap).",
    sections: [
      {
        id: "strane",
        title: "1. Strane",
        paragraphs: [
          `Klinika (Controller / voditelj obrade) ↔ ${PRODUCT_NAME} (Processor / obradaitelj).`,
          "Ovaj DPA reguliše obradu podataka pacijenata i povezanih kategorija koje Klinika unese u DentOrd.",
        ],
      },
      {
        id: "predmet",
        title: "2. Predmet i trajanje",
        paragraphs: [
          "Predmet: obrada ličnih i zdravstvenih podataka radi pružanja DentOrd SaaS usluge.",
          "Trajanje: dok Klinika ima aktivan nalog ili dok traju obaveze čuvanja/brisanja nakon raskida.",
        ],
      },
      {
        id: "priroda",
        title: "3. Priroda obrade",
        paragraphs: [
          "Hostiranje, storage, prikaz u aplikaciji, email delivery (podsjetnici/transakcijski), backup i povezane tehničke operacije potrebne za uslugu.",
        ],
      },
      {
        id: "vrste",
        title: "4. Vrste podataka",
        paragraphs: [
          "Identifikacioni i kontakt podaci, zdravstveni podaci i dokumenti koje unese Klinika, termini, fakture i povezani administrativni zapisi.",
        ],
      },
      {
        id: "kategorije",
        title: "5. Kategorije ispitanika",
        paragraphs: [
          "Pacijenti Klinike i zaposleni / korisnici Klinike čiji se podaci obrađuju u okviru usluge.",
        ],
      },
      {
        id: "obaveze",
        title: "6. Obaveze Processor-a",
        paragraphs: [
          "Processor obrađuje podatke pacijenata isključivo radi pružanja DentOrd usluge Klinici i po dokumentovanim uputama Controller-a (uključujući konfiguraciju u aplikaciji).",
          "Processor ne koristi podatke pacijenata za treniranje javnih AI modela trećih strana bez eksplicitnog ugovornog osnova i Controllera.",
          "Obaveze uključuju: povjerljivost osoblja, odgovarajuće tehničke i organizacijske mjere, pomoć Controller-u oko prava ispitanika, te angažman podobradaitelja pod jednakim zaštitama.",
        ],
      },
      {
        id: "podobradaitelji",
        title: "7. Lista podobradaitelja",
        paragraphs: [
          "Trenutni podobradaitelji uključuju: Supabase, Vercel, Resend, Sentry, PostHog (bez imena pacijenata u analytics), te Stripe od naplate.",
          "O izmjeni materijalnih podobradaitelja Controller će biti obaviješten u razumnom roku i imati pravo prigovora u skladu s primjenjivim propisima.",
        ],
      },
      {
        id: "transferi",
        title: "8. Međunarodni transferi",
        paragraphs: [
          "Default je obrada u EU. Ako ikad zatreba transfer izvan EEA, koristit će se odgovarajući mehanizmi (npr. SCC) gdje je to zakonski potrebno.",
        ],
      },
      {
        id: "prava-ispitanika",
        title: "9. Prava ispitanika — pomoć Controller-u",
        paragraphs: [
          "Processor će razumno pomoći Controller-u da odgovori na zahtjeve ispitanika (pristup, ispravka, brisanje, prenosivost) kroz alate u aplikaciji i podršku.",
        ],
      },
      {
        id: "breach",
        title: "10. Obavijest o povredi",
        paragraphs: [
          "U slučaju povrede podataka, Processor će obavijestiti Controller bez nepotrebnog odgađanja — orijentir 72 sata od saznanja — s informacijama dostupnim u tom trenutku.",
        ],
      },
      {
        id: "brisanje",
        title: "11. Brisanje / povrat podataka nakon raskida",
        paragraphs: [
          "Nakon raskida, Controller može izvesti podatke u predviđenom roku. Zatim Processor briše ili anonimizira podatke Klinike, osim gdje zakon nalaže duže čuvanje.",
        ],
      },
      {
        id: "audit",
        title: "12. Audit prava",
        paragraphs: [
          "Controller može, uz razumni interval, NDA i prethodnu najavu, tražiti informacije ili audit relevantan za usklađenost Processor-a s ovim DPA-om.",
        ],
      },
      {
        id: "prihvatanje",
        title: "13. Prihvatanje (clickwrap)",
        paragraphs: [
          "DPA se smatra prihvaćenim kada vlasnik Klinike pri signup-u označi prihvatanje Terms + Privacy. Dodatni potpis nije potreban za v1, osim ako strane drugačije ne dogovore.",
          `Pitanja: ${EMAIL_SUPPORT}.`,
        ],
      },
    ],
  };
}

function dpaEn(): LegalDocument {
  return {
    title: "Data Processing Agreement (DPA)",
    description:
      "Data processing agreement between the Clinic (controller) and DentOrd (processor).",
    lastUpdated: DPA_LAST_UPDATED,
    disclaimer:
      "Working draft DPA. Legal review is required before paid production in 2027. Accepted via Terms at signup (clickwrap).",
    sections: [
      {
        id: "parties",
        title: "1. Parties",
        paragraphs: [
          `Clinic (Controller) ↔ ${PRODUCT_NAME} (Processor).`,
          "This DPA governs processing of patient data and related categories the Clinic enters into DentOrd.",
        ],
      },
      {
        id: "subject",
        title: "2. Subject and duration",
        paragraphs: [
          "Subject: processing of personal and health data to provide the DentOrd SaaS service.",
          "Duration: while the Clinic has an active account or while retention/deletion obligations after termination continue.",
        ],
      },
      {
        id: "nature",
        title: "3. Nature of processing",
        paragraphs: [
          "Hosting, storage, in-app display, email delivery (reminders/transactional), backup and related technical operations needed for the service.",
        ],
      },
      {
        id: "types",
        title: "4. Types of data",
        paragraphs: [
          "Identity and contact data, health data and documents entered by the Clinic, appointments, invoices and related admin records.",
        ],
      },
      {
        id: "categories",
        title: "5. Data subject categories",
        paragraphs: [
          "Clinic patients and Clinic employees/users whose data is processed in the service.",
        ],
      },
      {
        id: "obligations",
        title: "6. Processor obligations",
        paragraphs: [
          "The Processor processes patient data solely to provide DentOrd to the Clinic and on the Controller’s documented instructions (including in-app configuration).",
          "The Processor does not use patient data to train public third-party AI models without an explicit contractual basis and Controller approval.",
          "Obligations include: staff confidentiality, appropriate technical and organisational measures, assistance with data-subject rights, and engagement of sub-processors under equivalent protections.",
        ],
      },
      {
        id: "subprocessors",
        title: "7. Sub-processors",
        paragraphs: [
          "Current sub-processors include: Supabase, Vercel, Resend, Sentry, PostHog (no patient names in analytics), and Stripe once billing starts.",
          "Material sub-processor changes will be notified to the Controller within a reasonable time, with a right to object under applicable law.",
        ],
      },
      {
        id: "transfers",
        title: "8. International transfers",
        paragraphs: [
          "Default processing is in the EU. If a transfer outside the EEA is ever required, appropriate mechanisms (e.g. SCCs) will be used where legally necessary.",
        ],
      },
      {
        id: "rights",
        title: "9. Data-subject rights — assistance",
        paragraphs: [
          "The Processor will reasonably assist the Controller in responding to data-subject requests (access, rectification, erasure, portability) via in-app tools and support.",
        ],
      },
      {
        id: "breach",
        title: "10. Breach notification",
        paragraphs: [
          "In case of a personal-data breach, the Processor will notify the Controller without undue delay — indicative 72 hours from awareness — with information available at that time.",
        ],
      },
      {
        id: "deletion",
        title: "11. Deletion / return after termination",
        paragraphs: [
          "After termination, the Controller may export data within the stated window. The Processor then deletes or anonymises Clinic data, except where law requires longer retention.",
        ],
      },
      {
        id: "audit",
        title: "12. Audit rights",
        paragraphs: [
          "The Controller may, at reasonable intervals, under NDA and prior notice, request information or an audit relevant to the Processor’s compliance with this DPA.",
        ],
      },
      {
        id: "acceptance",
        title: "13. Acceptance (clickwrap)",
        paragraphs: [
          "This DPA is deemed accepted when the Clinic owner checks acceptance of Terms + Privacy at signup. No additional signature is required for v1 unless parties agree otherwise.",
          `Questions: ${EMAIL_SUPPORT}.`,
        ],
      },
    ],
  };
}
