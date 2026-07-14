import type { LegalDocument } from "@/lib/legal/types";
import { EMAIL_SUPPORT, PRODUCT_NAME } from "@/lib/brand/constants";

/** Terms of Service draft from PRD §13.2 — not a substitute for legal review. */
export const TERMS_LAST_UPDATED = "2026-07-14";

export function getTermsDocument(locale: string): LegalDocument {
  return locale === "en" ? termsEn() : termsBs();
}

function termsBs(): LegalDocument {
  return {
    title: "Uslovi korištenja",
    description: "Uslovi korištenja DentOrd platforme za stomatološke ordinacije.",
    lastUpdated: TERMS_LAST_UPDATED,
    disclaimer:
      "Ovaj tekst je radni draft. Mjerodavno pravo i sporovi bit će precizirani nakon registracije firme. Nije zamjena za advokata.",
    sections: [
      {
        id: "prihvatanje",
        title: "1. Prihvatanje uslova",
        paragraphs: [
          `Korištenjem ${PRODUCT_NAME} usluge ili kreiranjem naloga prihvatate ove Uslove korištenja i Politiku privatnosti. Ako ne prihvatate uslove, nemojte koristiti uslugu.`,
          "Prihvatanjem Terms-a, Klinika također prihvata DPA za obradu podataka pacijenata (PRD §13.4).",
        ],
      },
      {
        id: "opis",
        title: "2. Opis usluge",
        paragraphs: [
          "DentOrd je SaaS softver za upravljanje stomatološkom ordinacijom: kartoni, termini, fakture, inventar i povezane administrativne funkcije.",
          "Funkcije i limiti zavise od izabranog paketa (Starter, Professional, Premium AI, Enterprise) kako je prikazano na stranici Cijene.",
        ],
      },
      {
        id: "nalozi",
        title: "3. Nalozi i odgovornost Klinike",
        paragraphs: [
          "Klinika je odgovorna za tačnost podataka naloga, upravljanje pristupom osoblja (uključujući dijeljeni PIN gdje je omogućen) i za aktivnosti izvršene pod njenim nalogom.",
          "Vlasnik naloga mora koristiti MFA. Klinika ne smije dijeliti vlasničke vjerodajnice s trećim licima van ovlaštenog tima.",
        ],
      },
      {
        id: "trial",
        title: "4. Besplatni period i pretplate",
        paragraphs: [
          "Tokom besplatnog perioda do 31.12.2026. usluga se pruža “as is” radi evaluacije. Kreditna kartica nije potrebna za taj period.",
          "Nakon isteka plaćenog ili besplatnog perioda, DentOrd može prevesti nalog u režim samo-za-čitanje na do 7 dana, omogućiti izvoz podataka, a zatim trajno obrisati podatke Klinike u skladu s politikom čuvanja.",
          "Od 2027. primjenjuju se plaćene pretplate (mjesečno; godišnja opcija s 2 mjeseca gratis kako bude objavljeno).",
        ],
      },
      {
        id: "upotreba",
        title: "5. Prihvatljiva upotreba",
        paragraphs: [
          "Zabranjeno je: zloupotreba usluge, pokušaji zaobilaženja RLS-a ili sigurnosnih kontrola, skeniranje/penetracija bez dogovora, nezakonit unos podataka, ometanje drugih korisnika ili infrastrukture.",
          "Zadržavamo pravo da suspendujemo naloge koji krše ove uslove.",
        ],
      },
      {
        id: "medicinski",
        title: "6. Medicinski disclaimer",
        paragraphs: [
          "DentOrd je softverski alat za evidenciju i administraciju. Ne pruža medicinski savjet, dijagnozu ni terapiju. Sve kliničke odluke donosi ovlašteni zdravstveni radnik. AI funkcije (ako su uključene) generišu nacrte koje korisnik mora pregledati i potvrditi prije spremanja u karton.",
        ],
      },
      {
        id: "ip",
        title: "7. Intelektualno vlasništvo",
        paragraphs: [
          "DentOrd platforma, brend, dizajn i softver ostaju vlasništvo operatera. Klinika zadržava prava na svoje podatke i sadržaj koji unese.",
        ],
      },
      {
        id: "sadrzaj",
        title: "8. Korisnički sadržaj i licenca za hosting",
        paragraphs: [
          "Klinika nam daje ograničenu licencu za hostanje, backup i prikaz njenog sadržaja isključivo radi pružanja usluge. Ne koristimo podatke pacijenata za treniranje javnih AI modela trećih strana bez eksplicitnog ugovornog osnova.",
        ],
      },
      {
        id: "naknade",
        title: "9. Naknade, PDV i neplaćanje",
        paragraphs: [
          "Cijene su u EUR sa PDV-om kako je prikazano na stranici Cijene. Metered troškovi (npr. SMS/WhatsApp, AI) naplaćuju se od uključivanja kanala po objavljenim jediničnim cijenama.",
          "Neplaćanje može dovesti do readonly režima, a zatim do brisanja u skladu s politikom čuvanja i grace periodom za export.",
        ],
      },
      {
        id: "raskid",
        title: "10. Suspendovanje i raskid",
        paragraphs: [
          "Možete raskinuti pretplatu u skladu s procesom u aplikaciji. Mi možemo suspendovati ili raskinuti pristup zbog kršenja uslova, neplaćanja ili pravnih obaveza.",
          "Nakon raskida, Klinika može izvesti podatke u predviđenom roku prije brisanja.",
        ],
      },
      {
        id: "odgovornost",
        title: "11. Ograničenje odgovornosti",
        paragraphs: [
          "U najvećoj mjeri dozvoljenoj zakonom, DentOrd se pruža “kakav jeste”. Ne odgovaramo za indirektne štete, gubitak profita ili kliničke ishode. Ukupna odgovornost ograničena je na iznose plaćene u prethodnih 12 mjeseci (ili nulu tokom potpuno besplatnog perioda), osim gdje zakon zabranjuje takvo ograničenje.",
        ],
      },
      {
        id: "odsteta",
        title: "12. Odšteta",
        paragraphs: [
          "Klinika će nas obeštetiti zbog zahtjeva trećih lica koji proizlaze iz nezakonite upotrebe usluge, sadržaja koji Klinika unese ili kršenja ovih uslova, u mjeri dozvoljenoj zakonom.",
        ],
      },
      {
        id: "pravo",
        title: "13. Mjerodavno pravo / sporovi",
        paragraphs: [
          `Mjerodavno pravo i nadležnost bit će određeni nakon registracije pravnog lica koje operira DentOrd (TBD). Do tada, strane nastoje riješiti sporove u dobroj vjeri putem ${EMAIL_SUPPORT}.`,
        ],
      },
      {
        id: "kontakt",
        title: "14. Kontakt",
        paragraphs: [`Pitanja o ovim uslovima: ${EMAIL_SUPPORT}.`],
      },
    ],
  };
}

function termsEn(): LegalDocument {
  return {
    title: "Terms of Service",
    description: "Terms for using the DentOrd platform for dental clinics.",
    lastUpdated: TERMS_LAST_UPDATED,
    disclaimer:
      "This text is a working draft. Governing law and disputes will be specified after company registration. It is not a substitute for legal advice.",
    sections: [
      {
        id: "acceptance",
        title: "1. Acceptance",
        paragraphs: [
          `By using ${PRODUCT_NAME} or creating an account you accept these Terms of Service and the Privacy Policy. If you do not agree, do not use the service.`,
          "By accepting the Terms, the Clinic also accepts the DPA for processing patient data (PRD §13.4).",
        ],
      },
      {
        id: "service",
        title: "2. Service description",
        paragraphs: [
          "DentOrd is SaaS software for dental practice management: charts, scheduling, invoices, inventory and related admin features.",
          "Features and limits depend on the selected plan (Starter, Professional, Premium AI, Enterprise) as shown on the Pricing page.",
        ],
      },
      {
        id: "accounts",
        title: "3. Accounts and Clinic responsibility",
        paragraphs: [
          "The Clinic is responsible for account accuracy, staff access (including shared PIN where enabled) and activity under its account.",
          "The account owner must use MFA. The Clinic must not share owner credentials with anyone outside the authorised team.",
        ],
      },
      {
        id: "trial",
        title: "4. Free period and subscriptions",
        paragraphs: [
          "During the free period until 31 Dec 2026 the service is provided “as is” for evaluation. No credit card is required for that period.",
          "After a paid or free period ends, DentOrd may move the account to read-only for up to 7 days, enable data export, then permanently delete Clinic data per retention policy.",
          "From 2027, paid subscriptions apply (monthly; annual option with 2 months free as published).",
        ],
      },
      {
        id: "acceptable-use",
        title: "5. Acceptable use",
        paragraphs: [
          "Prohibited: abuse of the service, attempts to bypass RLS or security controls, scanning/penetration without agreement, unlawful data entry, or disruption of other users or infrastructure.",
          "We may suspend accounts that violate these terms.",
        ],
      },
      {
        id: "medical",
        title: "6. Medical disclaimer",
        paragraphs: [
          "DentOrd is a software tool for records and administration. It does not provide medical advice, diagnosis or treatment. All clinical decisions are made by a licensed healthcare professional. AI features (if enabled) produce drafts that the user must review and confirm before saving to the chart.",
        ],
      },
      {
        id: "ip",
        title: "7. Intellectual property",
        paragraphs: [
          "The DentOrd platform, brand, design and software remain the operator’s property. The Clinic retains rights to its data and content.",
        ],
      },
      {
        id: "content",
        title: "8. User content and hosting licence",
        paragraphs: [
          "The Clinic grants us a limited licence to host, back up and display its content solely to provide the service. We do not use patient data to train public third-party AI models without an explicit contractual basis.",
        ],
      },
      {
        id: "fees",
        title: "9. Fees, VAT and non-payment",
        paragraphs: [
          "Prices are in EUR including VAT as shown on Pricing. Metered costs (e.g. SMS/WhatsApp, AI) are billed when those channels are enabled at published unit rates.",
          "Non-payment may lead to read-only mode and then deletion per retention policy and the export grace period.",
        ],
      },
      {
        id: "termination",
        title: "10. Suspension and termination",
        paragraphs: [
          "You may cancel per the in-app process. We may suspend or terminate access for terms violations, non-payment or legal obligations.",
          "After termination, the Clinic may export data within the stated window before deletion.",
        ],
      },
      {
        id: "liability",
        title: "11. Limitation of liability",
        paragraphs: [
          "To the fullest extent permitted by law, DentOrd is provided “as is”. We are not liable for indirect damages, lost profits or clinical outcomes. Aggregate liability is limited to amounts paid in the prior 12 months (or zero during a fully free period), except where law forbids such limitation.",
        ],
      },
      {
        id: "indemnity",
        title: "12. Indemnity",
        paragraphs: [
          "The Clinic will indemnify us against third-party claims arising from unlawful use, Clinic-entered content or breach of these terms, to the extent permitted by law.",
        ],
      },
      {
        id: "law",
        title: "13. Governing law / disputes",
        paragraphs: [
          `Governing law and venue will be set after registration of the legal entity operating DentOrd (TBD). Until then, parties will try to resolve disputes in good faith via ${EMAIL_SUPPORT}.`,
        ],
      },
      {
        id: "contact",
        title: "14. Contact",
        paragraphs: [`Questions about these terms: ${EMAIL_SUPPORT}.`],
      },
    ],
  };
}
