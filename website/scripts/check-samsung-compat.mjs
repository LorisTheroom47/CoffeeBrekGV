import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const read = (relativePath) =>
  readFileSync(resolve(projectRoot, relativePath), "utf8");

const layout = read("src/app/layout.tsx");
const tvPage = read("src/app/tv/page.tsx");
const footer = read("src/components/Footer.tsx");
const tvSlides = read("src/components/tv/TvMenuSlides.tsx");
const compatibilityCss = read("src/app/samsung-compat.css");

const checks = [
  [
    "La pagina TV non deve richiedere cookie o PIN",
    !/cookies\(|TvPinGate|TV_SESSION|TV_ACCESS_PIN/.test(tvPage),
  ],
  [
    "La route POST del vecchio accesso PIN deve essere assente",
    !existsSync(resolve(projectRoot, "src/app/tv/access/route.ts")),
  ],
  [
    "Il vecchio helper della sessione TV deve essere assente",
    !existsSync(resolve(projectRoot, "src/lib/tv/session.ts")),
  ],
  [
    "Il footer deve collegare la visualizzazione TV",
    footer.includes('href="/tv"') &&
      footer.includes("Visualizzazione TV"),
  ],
  [
    "Il viewport deve usare la larghezza del dispositivo",
    layout.includes('width: "device-width"') &&
      layout.includes('import "./samsung-compat.css"'),
  ],
  [
    "Devono essere presenti fallback per clamp, min e aspect-ratio",
    compatibilityCss.includes("@supports not (font-size: clamp") &&
      compatibilityCss.includes("@supports not (width: min") &&
      compatibilityCss.includes("@supports not (aspect-ratio"),
  ],
  [
    "Le slide TV devono evitare sintassi/API problematiche",
    !tvSlides.includes("?.") &&
      !tvSlides.includes("??") &&
      !tvSlides.includes(".flatMap("),
  ],
];

const failures = checks
  .filter(([, passed]) => !passed)
  .map(([description]) => description);

if (failures.length > 0) {
  console.error("Controllo Samsung non superato:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Controllo Samsung superato.");
}
