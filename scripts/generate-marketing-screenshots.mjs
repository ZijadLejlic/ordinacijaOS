/**
 * Generates marketing WebP UI mocks (2×) from SVG — brand palette, denser
 * app chrome so BrowserFrame panels don't look empty.
 * Run: node scripts/generate-marketing-screenshots.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/marketing/screenshots");

const INK = "#0F1B3D";
const ACCENT = "#0B6EF5";
const DEEP = "#0047C7";
const CYAN = "#2EC8F0";
const MIST = "#E8F4FF";
const WASH = "#F5FAFF";
const WHITE = "#FFFFFF";
const MUTED = "#5B6785";
const LINE = "#D7E4F5";
const SIDEBAR = "#0A1633";

const NAV = [
  "Dashboard",
  "Pacijenti",
  "Kalendar",
  "Fakture",
  "CRM",
  "Inventar",
  "Postavke",
];

const SHOTS = [
  {
    id: "signup",
    title: "Registracija ordinacije",
    badge: "signup",
    variant: "auth",
    rows: [
      "Email: owner@softic.ba",
      "Naziv: Ordinacija Softić",
      "Grad: Sarajevo",
      "Bez kartice · besplatno do 31.12.2026",
    ],
  },
  {
    id: "onboarding-1",
    title: "Onboarding · lokacija",
    badge: "1/3",
    variant: "form",
    navActive: 6,
    rows: [
      "Adresa: Ferhadija 12, Sarajevo",
      "Vremenska zona: Europe/Sarajevo",
      "Telefon: +387 33 000 000",
      "Radno vrijeme: Pon–Pet 08–16",
    ],
  },
  {
    id: "onboarding-2",
    title: "Onboarding · cjenovnik",
    badge: "2/3",
    variant: "list",
    navActive: 6,
    columns: ["Usluga", "Trajanje", "Cijena"],
    rows: [
      ["Kontrola", "30 min", "25 KM"],
      ["Plomba", "45 min", "45 KM"],
      ["Higijena", "40 min", "35 KM"],
      ["Vađenje", "30 min", "50 KM"],
      ["Endodoncija", "60 min", "90 KM"],
    ],
  },
  {
    id: "onboarding-3",
    title: "Onboarding · tim",
    badge: "3/3",
    variant: "list",
    navActive: 6,
    columns: ["Član", "Uloga", "Status"],
    rows: [
      ["Dr. Softić", "Vlasnik", "MFA ✓"],
      ["Dr. Hodžić", "Doktor", "Aktivan"],
      ["Sara Delić", "Recepcionarka", "Pozivnica"],
      ["Emir Begić", "Doktor", "Aktivan"],
    ],
  },
  {
    id: "patients",
    title: "Pacijenti",
    badge: "UI",
    variant: "list",
    navActive: 1,
    columns: ["Pacijent", "Telefon", "Sljedeća kontrola"],
    rows: [
      ["Amina Hodžić", "+387 61 111 111", "28.07.2026"],
      ["Emir Begić", "+387 62 222 222", "02.08.2026"],
      ["Lejla Softić", "+387 63 333 333", "05.08.2026"],
      ["Haris Delić", "+387 61 444 444", "10.08.2026"],
      ["Sara Kovačević", "+387 62 555 555", "12.08.2026"],
      ["Nina Marković", "+387 63 666 666", "15.08.2026"],
    ],
  },
  {
    id: "chart",
    title: "Karton · Amina Hodžić",
    badge: "UI",
    variant: "chart",
    navActive: 1,
  },
  {
    id: "odontogram",
    title: "Odontogram · Amina Hodžić",
    badge: "FDI",
    variant: "odontogram",
    navActive: 1,
  },
  {
    id: "plan",
    title: "Plan terapije",
    badge: "UI",
    variant: "list",
    navActive: 1,
    columns: ["Stavka", "Zub", "Status", "Cijena"],
    rows: [
      ["Plomba", "16", "U planu", "45 KM"],
      ["Higijena", "—", "Zakazano", "35 KM"],
      ["Kontrola", "—", "Urađeno", "25 KM"],
      ["Endodoncija", "26", "U planu", "90 KM"],
    ],
  },
  {
    id: "calendar",
    title: "Kalendar · sedmica",
    badge: "week",
    variant: "calendar",
    navActive: 2,
    rows: ["09:00 Amina · kontrola", "10:30 Emir · plomba", "12:00 Lejla · higijena", "14:00 Haris · vađenje"],
  },
  {
    id: "appointment-modal",
    title: "Novi termin",
    badge: "modal",
    variant: "modal",
    navActive: 2,
    rows: [
      "Pacijent: Emir Begić",
      "Doktor: Dr. Softić",
      "Usluga: Plomba · 45 min",
      "Uto 10:30 – 11:00",
      "Lokacija: Ordinacija Softić",
    ],
  },
  {
    id: "waitlist",
    title: "Waitlist",
    badge: "UI",
    variant: "list",
    navActive: 2,
    columns: ["Pacijent", "Preferirani termin", "Prioritet"],
    rows: [
      ["Sara Delić", "Uto prijepodne", "Visok"],
      ["Nina Marković", "Čet popodne", "Srednji"],
      ["Haris Delić", "Pet 09:00", "Visok"],
      ["Emir Begić", "Bilo kada", "Nizak"],
    ],
  },
  {
    id: "invoice",
    title: "Faktura FA-2026-014",
    badge: "UI",
    variant: "invoice",
    navActive: 3,
  },
  {
    id: "payments",
    title: "Uplate i rate",
    badge: "UI",
    variant: "list",
    navActive: 3,
    columns: ["Datum", "Iznos", "Način", "Status"],
    rows: [
      ["12.07.2026", "30,00 KM", "Gotovina", "Uplaćeno"],
      ["20.07.2026", "22,65 KM", "Kartica", "Zakazano"],
      ["01.08.2026", "45,00 KM", "Virman", "U planu"],
    ],
  },
  {
    id: "reports",
    title: "Izvještaji",
    badge: "UI",
    variant: "dashboard",
    navActive: 3,
    kpis: [
      { label: "Promet (mjesec)", value: "4.820 KM" },
      { label: "Troškovi", value: "1.140 KM" },
      { label: "Marža", value: "76%" },
    ],
    rows: ["Top usluga: Higijena", "Doktor Softić · 2.140 KM", "Izvoz Excel · spreman"],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    badge: "KPI",
    variant: "dashboard",
    navActive: 0,
    kpis: [
      { label: "Pacijenti danas", value: "12" },
      { label: "Prihod danas", value: "480 KM" },
      { label: "Termini", value: "8" },
    ],
    rows: [
      "09:00 Amina Hodžić · Kontrola",
      "10:30 Emir Begić · Plomba",
      "12:00 Lejla Softić · Higijena",
      "14:00 Haris Delić · Vađenje",
    ],
  },
  {
    id: "crm",
    title: "CRM recall",
    badge: "UI",
    variant: "list",
    navActive: 4,
    columns: ["Pacijent", "Zadnja posjeta", "Akcija"],
    rows: [
      ["Amina Hodžić", "6+ mj", "Podsjetnik"],
      ["Emir Begić", "8 mj", "Podsjetnik"],
      ["Lejla Softić", "7 mj", "Poziv"],
      ["Sara Delić", "9 mj", "Email"],
      ["Nina Marković", "6 mj", "Podsjetnik"],
    ],
  },
  {
    id: "inventory",
    title: "Inventar",
    badge: "UI",
    variant: "list",
    navActive: 5,
    columns: ["Artikal", "Stanje", "Min.", "Status"],
    rows: [
      ["Kompozit A2", "3", "5", "Nisko"],
      ["Rukavice M", "120", "40", "OK"],
      ["Anestetici", "14", "10", "OK"],
      ["Cement", "2", "4", "Nisko"],
      ["Maske", "80", "30", "OK"],
    ],
  },
  {
    id: "settings",
    title: "Postavke · tim",
    badge: "UI",
    variant: "list",
    navActive: 6,
    columns: ["Korisnik", "Uloga", "Sigurnost"],
    rows: [
      ["Dr. Softić", "Vlasnik", "MFA uključena"],
      ["Dr. Hodžić", "Doktor", "PIN aktivan"],
      ["Sara Delić", "Recepcionarka", "Pozivnica"],
      ["Audit log", "Sistem", "Aktivan"],
    ],
  },
  {
    id: "reminder",
    title: "Email podsjetnik",
    badge: "UI",
    variant: "email",
    navActive: 2,
  },
  {
    id: "mobile-calendar",
    title: "Kalendar",
    badge: "mobile",
    variant: "phone",
    phoneLabel: "Termini danas",
    rows: [
      "09:00 Amina · kontrola",
      "10:30 Emir · plomba",
      "12:00 Lejla · higijena",
      "14:00 Haris · vađenje",
      "15:30 Sara · kontrola",
    ],
  },
  {
    id: "mobile-chart",
    title: "Karton",
    badge: "mobile",
    variant: "phone",
    phoneLabel: "Amina Hodžić",
    rows: [
      "⚠ Alergija: penicilin",
      "Telefon: +387 61 111 111",
      "Dokumenti: 3 PDF",
      "RTG: 2 snimka",
      "Odontogram · otvoren",
    ],
  },
];

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sidebar(active = 0) {
  const items = NAV.map((label, i) => {
    const y = 110 + i * 52;
    const on = i === active;
    return `${
      on
        ? `<rect x="16" y="${y - 18}" width="188" height="40" rx="10" fill="${ACCENT}"/>`
        : ""
    }<text x="36" y="${y + 6}" font-family="system-ui,sans-serif" font-size="16" font-weight="${
      on ? "600" : "500"
    }" fill="${on ? WHITE : "rgba(255,255,255,0.72)"}">${esc(label)}</text>`;
  }).join("");
  return `<rect x="0" y="0" width="220" height="720" fill="${SIDEBAR}"/><text x="28" y="48" font-family="Georgia,serif" font-size="24" font-weight="700" fill="${WHITE}">DentOrd</text><text x="28" y="74" font-family="system-ui,sans-serif" font-size="12" fill="rgba(255,255,255,0.45)">Ordinacija Softić</text>${items}<rect x="16" y="640" width="188" height="48" rx="12" fill="rgba(255,255,255,0.08)"/><text x="36" y="670" font-family="system-ui,sans-serif" font-size="14" fill="rgba(255,255,255,0.7)">Dr. Softić</text>`;
}

function topbar(title, badge) {
  return `<text x="252" y="56" font-family="system-ui,sans-serif" font-size="26" font-weight="650" fill="${INK}">${esc(
    title,
  )}</text><rect x="1040" y="34" width="120" height="30" rx="8" fill="${MIST}"/><text x="1100" y="54" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="${ACCENT}">${esc(
    badge,
  )}</text>`;
}

function appShell(inner, { title, badge, navActive = 0 } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><rect width="1200" height="720" fill="${WASH}"/>${sidebar(
    navActive,
  )}<rect x="220" y="0" width="980" height="720" fill="${WASH}"/><rect x="236" y="20" width="948" height="680" rx="18" fill="${WHITE}" stroke="${LINE}" stroke-width="1"/>${topbar(
    title,
    badge,
  )}${inner}</svg>`;
}

function phonePanel(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="390" height="780" viewBox="0 0 390 780"><rect width="390" height="780" rx="36" fill="${SIDEBAR}"/><rect x="12" y="12" width="366" height="756" rx="28" fill="${WHITE}"/><rect x="145" y="24" width="100" height="10" rx="5" fill="${INK}" opacity="0.12"/>${inner}</svg>`;
}

function listTable(columns, rows, y0 = 100) {
  const colW = 900 / columns.length;
  const head = columns
    .map(
      (c, i) =>
        `<text x="${260 + i * colW}" y="${y0}" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="${MUTED}">${esc(
          c,
        )}</text>`,
    )
    .join("");
  const body = rows
    .map((row, ri) => {
      const y = y0 + 28 + ri * 72;
      const cells = (Array.isArray(row) ? row : [row])
        .map(
          (cell, ci) =>
            `<text x="${260 + ci * colW}" y="${y + 28}" font-family="system-ui,sans-serif" font-size="17" fill="${INK}">${esc(
              cell,
            )}</text>`,
        )
        .join("");
      const warn =
        String(row).includes("Nisko") ||
        (Array.isArray(row) && row.some((c) => String(c).includes("Nisko")));
      return `<rect x="252" y="${y}" width="900" height="58" rx="12" fill="${
        warn ? "#FFF4F0" : ri % 2 === 0 ? WASH : WHITE
      }" stroke="${LINE}" stroke-width="1"/>${cells}`;
    })
    .join("");
  return `${head}${body}`;
}

function formFields(rows, y0 = 110) {
  return rows
    .map((row, i) => {
      const y = y0 + i * 78;
      return `<text x="260" y="${y}" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="${MUTED}">Polje ${
        i + 1
      }</text><rect x="252" y="${y + 10}" width="900" height="48" rx="12" fill="${WASH}" stroke="${LINE}" stroke-width="1"/><text x="272" y="${
        y + 40
      }" font-family="system-ui,sans-serif" font-size="17" fill="${INK}">${esc(
        row,
      )}</text>`;
    })
    .join("");
}

function buildSvg(shot) {
  const badge = shot.badge ?? "UI";
  const title = shot.title;
  const navActive = shot.navActive ?? 0;

  if (shot.variant === "phone") {
    const rows = shot.rows ?? [];
    const label = shot.phoneLabel ?? title;
    const list = rows
      .map((row, i) => {
        const y = 110 + i * 88;
        const alert = String(row).startsWith("⚠");
        return `<rect x="32" y="${y}" width="326" height="72" rx="14" fill="${
          alert ? "#FFF4F0" : WASH
        }" stroke="${LINE}" stroke-width="1"/><text x="52" y="${
          y + 42
        }" font-family="system-ui,sans-serif" font-size="16" fill="${
          alert ? "#9F1239" : INK
        }">${esc(row)}</text>`;
      })
      .join("");
    return phonePanel(
      `<text x="32" y="78" font-family="system-ui,sans-serif" font-size="22" font-weight="650" fill="${INK}">${esc(
        label,
      )}</text><rect x="268" y="56" width="90" height="28" rx="8" fill="${MIST}"/><text x="313" y="75" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="${ACCENT}">${esc(
        badge,
      )}</text>${list}`,
    );
  }

  if (shot.variant === "auth") {
    const fields = (shot.rows ?? [])
      .map((row, i) => {
        const y = 210 + i * 78;
        return `<rect x="340" y="${y}" width="520" height="56" rx="12" fill="${WASH}" stroke="${LINE}" stroke-width="1"/><text x="360" y="${
          y + 34
        }" font-family="system-ui,sans-serif" font-size="17" fill="${INK}">${esc(
          row,
        )}</text>`;
      })
      .join("");
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${MIST}"/><stop offset="100%" stop-color="${WASH}"/></linearGradient></defs><rect width="1200" height="720" fill="url(#g)"/><rect x="280" y="80" width="640" height="560" rx="24" fill="${WHITE}" stroke="${LINE}" stroke-width="1"/><text x="600" y="150" text-anchor="middle" font-family="Georgia,serif" font-size="34" font-weight="700" fill="${INK}">DentOrd</text><text x="600" y="190" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" fill="${MUTED}">${esc(
      title,
    )}</text>${fields}<rect x="340" y="540" width="520" height="54" rx="12" fill="${ACCENT}"/><text x="600" y="574" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" font-weight="650" fill="${WHITE}">Kreiraj nalog</text></svg>`;
  }

  if (shot.variant === "odontogram") {
    const upper = Array.from({ length: 16 }, (_, i) => {
      const x = 280 + i * 52;
      const fill = i === 5 || i === 11 ? ACCENT : i === 8 ? CYAN : MIST;
      return `<rect x="${x}" y="150" width="42" height="48" rx="8" fill="${fill}" stroke="${LINE}" stroke-width="1"/>`;
    }).join("");
    const lower = Array.from({ length: 16 }, (_, i) => {
      const x = 280 + i * 52;
      const fill = i === 3 ? DEEP : i === 9 ? ACCENT : MIST;
      return `<rect x="${x}" y="280" width="42" height="48" rx="8" fill="${fill}" stroke="${LINE}" stroke-width="1"/>`;
    }).join("");
    const notes = [
      ["16", "Karies · plan plombe"],
      ["26", "Plomba · urađeno"],
      ["36", "Zdrav"],
      ["46", "Kontrola"],
    ]
      .map((row, i) => {
        const y = 400 + i * 58;
        return `<rect x="252" y="${y}" width="900" height="48" rx="12" fill="${WASH}" stroke="${LINE}" stroke-width="1"/><text x="272" y="${
          y + 30
        }" font-family="system-ui,sans-serif" font-size="17" font-weight="650" fill="${ACCENT}">Zub ${esc(
          row[0],
        )}</text><text x="360" y="${y + 30}" font-family="system-ui,sans-serif" font-size="17" fill="${INK}">${esc(
          row[1],
        )}</text>`;
      })
      .join("");
    return appShell(`${upper}${lower}${notes}`, {
      title,
      badge,
      navActive,
    });
  }

  if (shot.variant === "calendar") {
    const days = ["Pon 27", "Uto 28", "Sri 29", "Čet 30", "Pet 31"];
    const appts = [
      [
        [0, 0, "08:30", "Kontrola", ACCENT],
        [0, 1, "11:00", "Higijena", CYAN],
        [0, 2, "14:00", "Haris", DEEP],
        [0, 3, "16:00", "Softić", ACCENT],
      ],
      [
        [1, 0, "09:00", "Amina", ACCENT],
        [1, 1, "10:30", "Emir", DEEP],
        [1, 2, "13:00", "Lejla", CYAN],
        [1, 3, "15:30", "Sara", ACCENT],
      ],
      [
        [2, 0, "08:00", "Nina", CYAN],
        [2, 1, "10:00", "Plomba", ACCENT],
        [2, 2, "12:30", "Vađenje", DEEP],
        [2, 3, "15:00", "Emir", CYAN],
      ],
      [
        [3, 0, "09:30", "Amina", ACCENT],
        [3, 1, "11:30", "Plan", DEEP],
        [3, 2, "14:30", "Kontrola", ACCENT],
        [3, 3, "16:30", "Softić", CYAN],
      ],
      [
        [4, 0, "08:30", "Amina", ACCENT],
        [4, 1, "10:00", "Haris", DEEP],
        [4, 2, "13:00", "Lejla", CYAN],
        [4, 3, "15:00", "Sara", ACCENT],
      ],
    ];
    const cells = days
      .map((d, i) => {
        const x = 252 + i * 184;
        const blocks = (appts[i] ?? [])
          .map(([, bi, time, name, color]) => {
            const y = 148 + bi * 118;
            return `<rect x="${x + 10}" y="${y}" width="160" height="100" rx="12" fill="${color}"/><text x="${
              x + 22
            }" y="${y + 32}" font-family="system-ui,sans-serif" font-size="14" fill="${WHITE}" opacity="0.9">${esc(
              time,
            )}</text><text x="${x + 22}" y="${
              y + 60
            }" font-family="system-ui,sans-serif" font-size="17" font-weight="650" fill="${WHITE}">${esc(
              name,
            )}</text>`;
          })
          .join("");
        return `<rect x="${x}" y="100" width="176" height="560" rx="14" fill="${WASH}" stroke="${LINE}" stroke-width="1"/><text x="${
          x + 16
        }" y="${132}" font-family="system-ui,sans-serif" font-size="15" font-weight="600" fill="${MUTED}">${esc(
          d,
        )}</text>${blocks}`;
      })
      .join("");
    return appShell(cells, { title, badge, navActive });
  }

  if (shot.variant === "dashboard") {
    const kpis = shot.kpis ?? [
      { label: "KPI", value: "—" },
      { label: "KPI", value: "—" },
      { label: "KPI", value: "—" },
    ];
    const kpiBlocks = kpis
      .map((kpi, i) => {
        const x = 252 + i * 308;
        return `<rect x="${x}" y="100" width="292" height="120" rx="16" fill="${WASH}" stroke="${LINE}" stroke-width="1"/><text x="${
          x + 22
        }" y="140" font-family="system-ui,sans-serif" font-size="14" fill="${MUTED}">${esc(
          kpi.label,
        )}</text><text x="${x + 22}" y="188" font-family="Georgia,serif" font-size="36" font-weight="700" fill="${INK}">${esc(
          kpi.value,
        )}</text>`;
      })
      .join("");
    const scheduleTitle = `<text x="260" y="270" font-family="system-ui,sans-serif" font-size="16" font-weight="650" fill="${INK}">Današnji termini</text>`;
    const rows = (shot.rows ?? [])
      .map((row, i) => {
        const y = 292 + i * 72;
        return `<rect x="252" y="${y}" width="900" height="58" rx="12" fill="${
          i % 2 === 0 ? WASH : WHITE
        }" stroke="${LINE}" stroke-width="1"/><circle cx="280" cy="${
          y + 29
        }" r="7" fill="${i === 0 ? ACCENT : i === 1 ? CYAN : DEEP}"/><text x="304" y="${
          y + 35
        }" font-family="system-ui,sans-serif" font-size="17" fill="${INK}">${esc(
          row,
        )}</text>`;
      })
      .join("");
    return appShell(`${kpiBlocks}${scheduleTitle}${rows}`, {
      title,
      badge,
      navActive,
    });
  }

  if (shot.variant === "chart") {
    const allergy = `<rect x="252" y="100" width="900" height="58" rx="14" fill="#FFF4F0" stroke="#FECDD3" stroke-width="1"/><text x="276" y="136" font-family="system-ui,sans-serif" font-size="17" font-weight="650" fill="#9F1239">⚠ Upozorenje: alergije — penicilin (teška)</text>`;
    const fields = [
      ["Telefon", "+387 61 111 111"],
      ["Email", "amina@example.ba"],
      ["Datum rođenja", "12.03.1992"],
      ["Sljedeća kontrola", "28.07.2026"],
      ["Dokumenti", "3 PDF · 2 RTG"],
      ["Anamneza", "Hipertenzija · kontrolisana"],
    ]
      .map((pair, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 252 + col * 460;
        const y = 178 + row * 96;
        return `<rect x="${x}" y="${y}" width="440" height="82" rx="14" fill="${WASH}" stroke="${LINE}" stroke-width="1"/><text x="${
          x + 20
        }" y="${y + 30}" font-family="system-ui,sans-serif" font-size="13" fill="${MUTED}">${esc(
          pair[0],
        )}</text><text x="${x + 20}" y="${
          y + 58
        }" font-family="system-ui,sans-serif" font-size="17" font-weight="600" fill="${INK}">${esc(
          pair[1],
        )}</text>`;
      })
      .join("");
    const history = [
      "14.07.2026 · Plomba 16 · Dr. Softić",
      "02.06.2026 · Higijena · Dr. Hodžić",
      "18.03.2026 · Kontrola · Dr. Softić",
    ]
      .map((row, i) => {
        const y = 490 + i * 52;
        return `<rect x="252" y="${y}" width="900" height="44" rx="10" fill="${
          i % 2 === 0 ? WASH : WHITE
        }" stroke="${LINE}" stroke-width="1"/><text x="272" y="${
          y + 28
        }" font-family="system-ui,sans-serif" font-size="15" fill="${INK}">${esc(
          row,
        )}</text>`;
      })
      .join("");
    return appShell(
      `${allergy}${fields}<text x="260" y="478" font-family="system-ui,sans-serif" font-size="15" font-weight="650" fill="${INK}">Posljednje posjete</text>${history}`,
      { title, badge, navActive },
    );
  }

  if (shot.variant === "invoice") {
    const lines = [
      ["Plomba · zub 16", "1", "45,00 KM"],
      ["PDV 17%", "", "7,65 KM"],
      ["Ukupno", "", "52,65 KM"],
    ]
      .map((row, i) => {
        const y = 220 + i * 70;
        const bold = i === 2;
        return `<rect x="252" y="${y}" width="900" height="58" rx="12" fill="${
          bold ? MIST : WASH
        }" stroke="${LINE}" stroke-width="1"/><text x="272" y="${
          y + 35
        }" font-family="system-ui,sans-serif" font-size="17" font-weight="${
          bold ? "700" : "500"
        }" fill="${INK}">${esc(row[0])}</text><text x="900" y="${
          y + 35
        }" text-anchor="end" font-family="system-ui,sans-serif" font-size="17" fill="${MUTED}">${esc(
          row[1],
        )}</text><text x="1130" y="${
          y + 35
        }" text-anchor="end" font-family="system-ui,sans-serif" font-size="18" font-weight="${
          bold ? "700" : "600"
        }" fill="${INK}">${esc(row[2])}</text>`;
      })
      .join("");
    return appShell(
      `<rect x="252" y="100" width="900" height="90" rx="14" fill="${WASH}" stroke="${LINE}" stroke-width="1"/><text x="272" y="140" font-family="system-ui,sans-serif" font-size="15" fill="${MUTED}">Pacijent</text><text x="272" y="170" font-family="system-ui,sans-serif" font-size="20" font-weight="650" fill="${INK}">Amina Hodžić</text><text x="900" y="140" font-family="system-ui,sans-serif" font-size="15" fill="${MUTED}">Datum</text><text x="900" y="170" font-family="system-ui,sans-serif" font-size="20" font-weight="650" fill="${INK}">14.07.2026</text>${lines}`,
      { title, badge, navActive },
    );
  }

  if (shot.variant === "email") {
    return appShell(
      `<rect x="252" y="100" width="900" height="540" rx="16" fill="${WASH}" stroke="${LINE}" stroke-width="1"/><text x="276" y="150" font-family="system-ui,sans-serif" font-size="14" fill="${MUTED}">Za: amina@example.ba</text><text x="276" y="190" font-family="system-ui,sans-serif" font-size="22" font-weight="650" fill="${INK}">Podsjetnik na termin · sutra 09:00</text><text x="276" y="250" font-family="system-ui,sans-serif" font-size="17" fill="${INK}">Poštovana Amina,</text><text x="276" y="290" font-family="system-ui,sans-serif" font-size="17" fill="${INK}">Podsjećamo Vas na termin sutra u 09:00 kod Dr. Softića.</text><text x="276" y="330" font-family="system-ui,sans-serif" font-size="17" fill="${INK}">Lokacija: Ferhadija 12, Sarajevo</text><rect x="276" y="380" width="220" height="48" rx="12" fill="${ACCENT}"/><text x="386" y="410" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" font-weight="650" fill="${WHITE}">Potvrdi termin</text><text x="276" y="480" font-family="system-ui,sans-serif" font-size="14" fill="${MUTED}">Predložak: bosanski · poslano automatski</text>`,
      { title, badge, navActive },
    );
  }

  if (shot.variant === "modal") {
    const fields = (shot.rows ?? [])
      .map((row, i) => {
        const y = 190 + i * 68;
        return `<rect x="350" y="${y}" width="700" height="50" rx="12" fill="${WASH}" stroke="${LINE}" stroke-width="1"/><text x="370" y="${
          y + 32
        }" font-family="system-ui,sans-serif" font-size="16" fill="${INK}">${esc(
          row,
        )}</text>`;
      })
      .join("");
    return appShell(
      `<rect x="300" y="90" width="800" height="560" rx="18" fill="rgba(15,27,61,0.18)"/><rect x="340" y="120" width="720" height="500" rx="18" fill="${WHITE}" stroke="${LINE}" stroke-width="1"/><text x="370" y="165" font-family="system-ui,sans-serif" font-size="22" font-weight="650" fill="${INK}">Novi termin</text>${fields}<rect x="370" y="545" width="170" height="44" rx="10" fill="${ACCENT}"/><text x="455" y="573" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="650" fill="${WHITE}">Sačuvaj</text>`,
      { title, badge, navActive },
    );
  }

  if (shot.variant === "form") {
    return appShell(
      `${formFields(shot.rows ?? [])}<rect x="252" y="560" width="200" height="48" rx="12" fill="${ACCENT}"/><text x="352" y="590" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" font-weight="650" fill="${WHITE}">Nastavi</text>`,
      { title, badge, navActive },
    );
  }

  // default list
  return appShell(listTable(shot.columns ?? ["Stavka"], shot.rows ?? []), {
    title,
    badge,
    navActive,
  });
}

mkdirSync(OUT, { recursive: true });

for (const shot of SHOTS) {
  const file = join(OUT, `${shot.id}.webp`);
  await sharp(Buffer.from(buildSvg(shot)), { density: 144 })
    .webp({ quality: 88, effort: 4 })
    .toFile(file);
  console.log("wrote", file);
}

writeFileSync(
  join(OUT, "manifest.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      shots: SHOTS.map((s) => s.id),
      note: "Dense app-chrome mocks for BrowserFrame; phone shots include device chrome.",
    },
    null,
    2,
  ),
);
console.log(`Done: ${SHOTS.length} WebP screenshots → ${OUT}`);
