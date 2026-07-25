import type { Author, Journal, Publication } from "@/lib/types";

// Visual fixtures only. Production must read branch-specific records from Supabase.
export const demoJournals: Journal[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "inquira",
    title: "InQuira",
    description: "A peer-reviewed journal for empirical research, classroom inquiry, and applied scholarship across the sciences, education, and social science.",
    scope: "Education, social science, language, public service, technology, health, and multidisciplinary research.",
    issn: "3000-0001",
    heroImage: "/assets/journal-academic-frontiers-hero.jpg",
    accent: "emerald"
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "lumera",
    title: "Lumera",
    description: "A literary journal for poetry, fiction, creative nonfiction, essays, and reflective writing.",
    scope: "Poetry, fiction, creative nonfiction, essays, literary reflection, and creative expression.",
    issn: "3000-0011",
    heroImage: "/assets/journal-echoes-expression-hero.jpg",
    accent: "clay"
  }
];

export const demoAuthors: Author[] = [
  {
    id: "a1111111-1111-4111-8111-111111111111",
    slug: "carole-estrella-clave",
    name: "Estrella-Clave, Carole",
    bio: "Published researcher in contextualized literature instruction and culturally responsive learning materials."
  },
  {
    id: "a2222222-2222-4222-8222-222222222222",
    slug: "francis-mervin-agdana",
    name: "Agdana, Francis Mervin L.",
    bio: "Published contributor to research on literature, contextualized learning, and senior high school instruction."
  },
  {
    id: "a3333333-3333-4333-8333-333333333333",
    slug: "botoy-et-al",
    name: "Botoy et al.",
    bio: "Research team behind a comprehensive literature review of environmental literacy among Filipino learners."
  },
  {
    id: "a4444444-4444-4444-8444-444444444444",
    slug: "mary-joy-cacho",
    name: "Cacho, Mary Joy V.",
    bio: "Published writer and educator contributing work on EPP and entrepreneurship education."
  },
  {
    id: "a5555555-5555-4555-8555-555555555555",
    slug: "danica-reyes",
    name: "Reyes, Danica P.",
    affiliation: "Department of English, Bulacan State University",
    bio: "Language educator researching translanguaging and reading comprehension in multilingual classrooms."
  },
  {
    id: "a5555555-5555-4555-8555-555555555556",
    slug: "mark-anthony-santos",
    name: "Santos, Mark Anthony R.",
    affiliation: "Plaridel National High School",
    bio: "Senior high school teacher and co-researcher on classroom language practice and literacy."
  },
  {
    id: "a5555555-5555-4555-8555-555555555557",
    slug: "jesrael-villanueva",
    name: "Villanueva, Jesrael T.",
    affiliation: "School of Accountancy, Polytechnic University of the Philippines",
    bio: "Researcher in financial literacy and consumer behavior among young learners."
  },
  {
    id: "a5555555-5555-4555-8555-555555555558",
    slug: "hannah-mae-dela-cruz",
    name: "Dela Cruz, Hannah Mae S.",
    affiliation: "Division of City Schools, Meycauayan",
    bio: "Educator studying teacher wellbeing and the realities of rural multigrade instruction."
  },
  {
    id: "a5555555-5555-4555-8555-555555555559",
    slug: "lorenzo-ocampo",
    name: "Ocampo, Lorenzo B.",
    affiliation: "Department of Psychology, University of the Philippines Diliman",
    bio: "Psychologist researching occupational stress and coping among teachers and public servants."
  },
  {
    id: "a5555555-5555-4555-8555-555555555560",
    slug: "rodelyn-bautista",
    name: "Bautista, Rodelyn M.",
    affiliation: "Municipal Disaster Risk Reduction Office, Hagonoy",
    bio: "Practitioner-researcher in community-based disaster preparedness in coastal towns."
  },
  {
    id: "a5555555-5555-4555-8555-555555555561",
    slug: "patricia-mendoza",
    name: "Mendoza, Patricia Anne L.",
    affiliation: "College of Education, Philippine Normal University",
    bio: "Scholar of language policy and mother-tongue-based multilingual education."
  },
  {
    id: "a5555555-5555-4555-8555-555555555562",
    slug: "miguel-salazar",
    name: "Salazar, Miguel Angelo D.",
    affiliation: "Independent writer, Manila",
    bio: "Poet writing on memory, family, and ecological change in the Philippine landscape."
  },
  {
    id: "a5555555-5555-4555-8555-555555555563",
    slug: "bea-torres",
    name: "Torres, Bea Clarisse N.",
    affiliation: "Creative Writing, University of Santo Tomas",
    bio: "Essayist and former classroom teacher writing on education and attention."
  },
  {
    id: "a5555555-5555-4555-8555-555555555564",
    slug: "josephine-aquino",
    name: "Aquino, Josephine R.",
    affiliation: "Independent writer, Quezon City",
    bio: "Fiction writer exploring inheritance, ritual, and domestic memory."
  },
  {
    id: "a5555555-5555-4555-8555-555555555565",
    slug: "theodore-lim",
    name: "Lim, Theodore S.",
    affiliation: "Department of Literature, Ateneo de Manila University",
    bio: "Essayist working on translation, oral tradition, and regional languages."
  },
  {
    id: "a5555555-5555-4555-8555-555555555566",
    slug: "aira-gonzales",
    name: "Gonzales, Aira Mae V.",
    affiliation: "Independent writer, Cebu",
    bio: "Poet documenting community life and small economies in provincial markets."
  }
];

const academicFrontiers = demoJournals[0];
const visionaryVoices = demoJournals[0];
const echoes = demoJournals[1];

const reyes = demoAuthors[4];
const santos = demoAuthors[5];
const villanueva = demoAuthors[6];
const delaCruz = demoAuthors[7];
const ocampo = demoAuthors[8];
const bautista = demoAuthors[9];
const mendoza = demoAuthors[10];
const salazar = demoAuthors[11];
const torres = demoAuthors[12];
const aquino = demoAuthors[13];
const lim = demoAuthors[14];
const gonzales = demoAuthors[15];

const ccBy = "Creative Commons Attribution 4.0 International";
const ccByUrl = "https://creativecommons.org/licenses/by/4.0/";

export const demoPublications: Publication[] = [
  {
    id: "b1111111-1111-4111-8111-111111111111",
    slug: "folk-narratives-as-contextualized-learning-materials-for-senior-high-school-students",
    title: "Folk Narratives as Contextualized Learning Materials for Senior High School Students",
    abstract: "This study determined the effectiveness of folk narratives as contextualized learning materials in teaching 21st-century literature among Grade 11 students of Plaridel National High School. Using a developmental research design based on the ADDIE model, it found that the culturally relevant materials were highly acceptable and produced a significant improvement between pretest and posttest performance.",
    keywords: ["folk narrative", "contextualized learning material", "senior high school"],
    journal: academicFrontiers,
    authors: [demoAuthors[0], demoAuthors[1]],
    authorDisplay: "Estrella-Clave, Carole; Agdana, Francis Mervin L.",
    publicationDate: "2026-06-26",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-14",
    volume: "2",
    issue: "6",
    pages: "291-305",
    doi: "10.5281/zenodo.20821745",
    pdfUrl: "https://doi.org/10.5281/zenodo.20821745",
    recommendedCitation: "Estrella-Clave, C., & L. Agdana, F. M. (2026). Folk Narratives as Contextualized Learning Materials for Senior High School Students. InQuira, 2(6), 291–305. https://doi.org/10.5281/zenodo.20821745",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The authors",
    featured: true,
    contentType: "research"
  },
  {
    id: "b2222222-2222-4222-8222-222222222222",
    slug: "environmental-literacy-and-knowledge-levels-of-filipino-learners-a-comprehensive-literature-review",
    title: "Environmental Literacy and Knowledge Levels of Filipino Learners: A Comprehensive Literature Review",
    abstract: "This scoping review examined ten studies on environmental literacy among Filipino students. It found generally moderate environmental knowledge, strong pro-environmental attitudes, and fair-to-moderate practices, with a persistent gap between awareness and behavior. Contextualized, participatory school and community interventions improved knowledge, attitudes, and practices.",
    keywords: ["environmental literacy", "Filipino learners", "literature review"],
    journal: visionaryVoices,
    authors: [demoAuthors[2]],
    authorDisplay: "Botoy, F. J. M.; Barbosa, C. J.; Cabatuan, G. K.; Lee, H. A.; Onyot, J.",
    publicationDate: "2026",
    publicationDatePrecision: "year",
    modifiedDate: "2026-07-14",
    volume: "2",
    issue: "1",
    pages: "16-25",
    doi: "10.5281/zenodo.18207397",
    pdfUrl: "https://doi.org/10.5281/zenodo.18207397",
    recommendedCitation: "Botoy, F. J. M., Barbosa, C. J., Cabatuan, G. K., Lee, H. A., & Onyot, J. (2026). Environmental Literacy and Knowledge Levels of Filipino Learners: A Comprehensive Literature Review. In InQuira (Vol. 2, Number 1, pp. 16–25). Talikha Publishing. https://doi.org/10.5281/zenodo.18207397",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The authors",
    featured: true,
    contentType: "research"
  },
  {
    id: "b3333333-3333-4333-8333-333333333333",
    slug: "innovation-in-epp-and-entrepreneurship-education",
    title: "Innovation in EPP and Entrepreneurship Education",
    abstract: "Innovation begins with curiosity. In every EPP and Entrepreneurship classroom, students discover that learning extends beyond theories and textbooks.",
    keywords: ["EPP", "entrepreneurship", "education"],
    journal: echoes,
    authors: [demoAuthors[3]],
    authorDisplay: "Cacho, Mary Joy V.",
    publicationDate: "2026-07-05",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-14",
    volume: "2",
    issue: "6",
    pages: "269",
    doi: "10.5281/zenodo.21131524",
    pdfUrl: "https://doi.org/10.5281/zenodo.21131524",
    recommendedCitation: "Cacho, M. J. V. (2026). Innovation in EPP and Entrepreneurship Education. In Lumera (Vol. 2, Number 6, p. 269). Talikha Publishing. https://doi.org/10.5281/zenodo.21131524",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The author",
    featured: true,
    contentType: "creative"
  },
  {
    id: "c1111111-1111-4111-8111-111111111111",
    slug: "code-switching-practices-and-reading-comprehension-among-grade-10-learners-in-bulacan",
    title: "Code-Switching Practices and Reading Comprehension Among Grade 10 Learners in Bulacan",
    abstract: "This mixed-methods study examined how Tagalog-English code-switching in classroom instruction relates to reading comprehension among 124 Grade 10 learners across three public schools in Bulacan. Comprehension scores were higher when teachers code-switched to clarify abstract vocabulary, while learners reported that strategic switching reduced anxiety during discussion. The findings support translanguaging as a deliberate, rather than incidental, pedagogical choice.",
    keywords: ["code-switching", "reading comprehension", "translanguaging"],
    journal: academicFrontiers,
    authors: [reyes, santos],
    authorDisplay: "Reyes, Danica P.; Santos, Mark Anthony R.",
    publicationDate: "2026-03-12",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-10",
    volume: "3",
    issue: "1",
    pages: "12-28",
    recommendedCitation: "Reyes, D. P., & Santos, M. A. R. (2026). Code-Switching Practices and Reading Comprehension Among Grade 10 Learners in Bulacan. InQuira, 3(1), 12–28. https://talikhapublishing.com/publications/code-switching-practices-and-reading-comprehension-among-grade-10-learners-in-bulacan",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The authors",
    featured: true,
    contentType: "research"
  },
  {
    id: "c2222222-2222-4222-8222-222222222222",
    slug: "financial-literacy-and-spending-behavior-of-senior-high-school-students-in-public-schools",
    title: "Financial Literacy and Spending Behavior of Senior High School Students in Public Schools",
    abstract: "Surveying 310 senior high school students, this study found moderate financial literacy alongside impulsive spending patterns driven by peer influence and digital wallets. Students who received even a single semester of applied budgeting instruction demonstrated measurably better saving intentions. The paper argues for embedding practical money management into the existing entrepreneurship curriculum.",
    keywords: ["financial literacy", "spending behavior", "senior high school"],
    journal: academicFrontiers,
    authors: [villanueva],
    authorDisplay: "Villanueva, Jesrael T.",
    publicationDate: "2026-02-20",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-08",
    volume: "3",
    issue: "1",
    pages: "29-44",
    recommendedCitation: "Villanueva, J. T. (2026). Financial Literacy and Spending Behavior of Senior High School Students in Public Schools. InQuira, 3(1), 29–44. https://talikhapublishing.com/publications/financial-literacy-and-spending-behavior-of-senior-high-school-students-in-public-schools",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The author",
    featured: false,
    contentType: "research"
  },
  {
    id: "c3333333-3333-4333-8333-333333333333",
    slug: "teacher-burnout-and-coping-strategies-in-rural-multigrade-classrooms",
    title: "Teacher Burnout and Coping Strategies in Rural Multigrade Classrooms",
    abstract: "Through interviews with 18 multigrade teachers in rural Bulacan and a burnout inventory, this study documents high emotional exhaustion tied to large combined grade levels and scarce materials. Teachers relied on peer mentoring, faith, and small classroom rituals to cope. The authors recommend structural support, not only individual resilience, as the path to sustainable teaching.",
    keywords: ["teacher burnout", "multigrade classrooms", "coping strategies"],
    journal: academicFrontiers,
    authors: [delaCruz, ocampo],
    authorDisplay: "Dela Cruz, Hannah Mae S.; Ocampo, Lorenzo B.",
    publicationDate: "2025-11-30",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-05",
    volume: "2",
    issue: "5",
    pages: "140-158",
    recommendedCitation: "Dela Cruz, H. M. S., & Ocampo, L. B. (2025). Teacher Burnout and Coping Strategies in Rural Multigrade Classrooms. InQuira, 2(5), 140–158. https://talikhapublishing.com/publications/teacher-burnout-and-coping-strategies-in-rural-multigrade-classrooms",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The authors",
    featured: true,
    contentType: "research"
  },
  {
    id: "c4444444-4444-4444-8444-444444444444",
    slug: "community-based-disaster-preparedness-knowledge-among-coastal-barangay-residents",
    title: "Community-Based Disaster Preparedness Knowledge Among Coastal Barangay Residents",
    abstract: "This descriptive study assessed disaster preparedness knowledge among 220 residents of two coastal barangays. Awareness of typhoon signals was high, but knowledge of evacuation routes and emergency kits was inconsistent. Barangay-level drills and household mapping were associated with stronger preparedness, suggesting that localized, repeated practice outperforms one-time information campaigns.",
    keywords: ["disaster preparedness", "coastal communities", "barangay"],
    journal: academicFrontiers,
    authors: [bautista],
    authorDisplay: "Bautista, Rodelyn M.",
    publicationDate: "2026-04-18",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-12",
    volume: "3",
    issue: "2",
    pages: "61-77",
    recommendedCitation: "Bautista, R. M. (2026). Community-Based Disaster Preparedness Knowledge Among Coastal Barangay Residents. InQuira, 3(2), 61–77. https://talikhapublishing.com/publications/community-based-disaster-preparedness-knowledge-among-coastal-barangay-residents",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The author",
    featured: false,
    contentType: "research"
  },
  {
    id: "c5555555-5555-4555-8555-555555555555",
    slug: "a-commentary-on-mother-tongue-based-multilingual-education-after-a-decade",
    title: "A Commentary on Mother-Tongue-Based Multilingual Education After a Decade",
    abstract: "A decade into the Philippines' mother-tongue-based multilingual education policy, this commentary weighs its promises against classroom realities. The author argues that the policy's intent was sound but its implementation was under-resourced, leaving teachers to improvise materials in languages without standardized orthographies. The piece calls for honest evaluation and sustained investment rather than quiet abandonment.",
    keywords: ["mother tongue", "multilingual education", "language policy"],
    journal: academicFrontiers,
    authors: [mendoza],
    authorDisplay: "Mendoza, Patricia Anne L.",
    publicationDate: "2026-05-09",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-13",
    volume: "3",
    issue: "2",
    pages: "78-86",
    recommendedCitation: "Mendoza, P. A. L. (2026). A Commentary on Mother-Tongue-Based Multilingual Education After a Decade. InQuira, 3(2), 78–86. https://talikhapublishing.com/publications/a-commentary-on-mother-tongue-based-multilingual-education-after-a-decade",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The author",
    featured: true,
    contentType: "commentary"
  },
  {
    id: "d1111111-1111-4111-8111-111111111111",
    slug: "the-river-remembers-our-names",
    title: "The River Remembers Our Names",
    abstract: "A sequence of poems tracing a family's relationship to a river that has flooded, dried, and returned across three generations. The work pairs domestic memory with ecological change, asking what is carried forward when a landscape no longer holds the shape of childhood.",
    keywords: ["poetry", "memory", "ecology"],
    journal: echoes,
    authors: [salazar],
    authorDisplay: "Salazar, Miguel Angelo D.",
    publicationDate: "2026-03-01",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-09",
    volume: "3",
    issue: "1",
    pages: "4-7",
    recommendedCitation: "Salazar, M. A. D. (2026). The River Remembers Our Names. Lumera, 3(1), 4–7. https://talikhapublishing.com/publications/the-river-remembers-our-names",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The author",
    featured: true,
    contentType: "creative"
  },
  {
    id: "d2222222-2222-4222-8222-222222222222",
    slug: "letters-to-a-classroom-i-left-behind",
    title: "Letters to a Classroom I Left Behind",
    abstract: "A series of epistolary essays written by a former teacher to the students and room she left when she changed careers. Each letter revisits a small object, a lesson that failed, or a quiet triumph, building a portrait of teaching as an act of attention rather than authority.",
    keywords: ["essay", "teaching", "creative nonfiction"],
    journal: echoes,
    authors: [torres],
    authorDisplay: "Torres, Bea Clarisse N.",
    publicationDate: "2026-04-02",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-11",
    volume: "3",
    issue: "2",
    pages: "18-23",
    recommendedCitation: "Torres, B. C. N. (2026). Letters to a Classroom I Left Behind. Lumera, 3(2), 18–23. https://talikhapublishing.com/publications/letters-to-a-classroom-i-left-behind",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The author",
    featured: false,
    contentType: "creative"
  },
  {
    id: "d3333333-3333-4333-8333-333333333333",
    slug: "salt-and-other-inheritances",
    title: "Salt and Other Inheritances",
    abstract: "A short story in which a woman returns to her grandmother's coastal home to settle an estate and inherits, instead, a way of preserving fish and a way of keeping silence. The narrative moves between the present and remembered summers, treating recipe and ritual as forms of inheritance that outlast property.",
    keywords: ["fiction", "inheritance", "family"],
    journal: echoes,
    authors: [aquino],
    authorDisplay: "Aquino, Josephine R.",
    publicationDate: "2025-12-15",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-06",
    volume: "2",
    issue: "6",
    pages: "270-278",
    recommendedCitation: "Aquino, J. R. (2025). Salt and Other Inheritances. Lumera, 2(6), 270–278. https://talikhapublishing.com/publications/salt-and-other-inheritances",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The author",
    featured: true,
    contentType: "creative"
  },
  {
    id: "d4444444-4444-4444-8444-444444444444",
    slug: "on-translating-grandmothers-proverbs",
    title: "On Translating Grandmother's Proverbs",
    abstract: "A reflective essay on the untranslatable, built around a single notebook of proverbs the author's grandmother spoke in a regional tongue. The piece considers what is lost, what is gained, and what is invented when an oral tradition is carried into a second language and onto the page.",
    keywords: ["essay", "translation", "oral tradition"],
    journal: echoes,
    authors: [lim],
    authorDisplay: "Lim, Theodore S.",
    publicationDate: "2026-05-21",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-14",
    volume: "3",
    issue: "2",
    pages: "24-29",
    recommendedCitation: "Lim, T. S. (2026). On Translating Grandmother's Proverbs. Lumera, 3(2), 24–29. https://talikhapublishing.com/publications/on-translating-grandmothers-proverbs",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The author",
    featured: false,
    contentType: "creative"
  },
  {
    id: "d5555555-5555-4555-8555-555555555555",
    slug: "market-day-a-sequence-of-poems",
    title: "Market Day: A Sequence of Poems",
    abstract: "Twelve short poems set in a provincial public market, each voiced by a different vendor, shopper, or child. The sequence treats the market as a stage of small economies and affections, where prices, gossip, and grief are all negotiated aloud before noon.",
    keywords: ["poetry", "market", "community"],
    journal: echoes,
    authors: [gonzales],
    authorDisplay: "Gonzales, Aira Mae V.",
    publicationDate: "2026-06-10",
    publicationDatePrecision: "day",
    modifiedDate: "2026-07-15",
    volume: "3",
    issue: "3",
    pages: "9-13",
    recommendedCitation: "Gonzales, A. M. V. (2026). Market Day: A Sequence of Poems. Lumera, 3(3), 9–13. https://talikhapublishing.com/publications/market-day-a-sequence-of-poems",
    licenseName: ccBy,
    licenseUrl: ccByUrl,
    copyrightHolder: "The author",
    featured: true,
    contentType: "creative"
  }
];
