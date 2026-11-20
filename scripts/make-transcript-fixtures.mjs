// Task 50: synthetic KAU-style English transcripts (PDF) and the rows a perfect reader must return.
//
//   npm run fixtures:transcripts   → tests/fixtures/transcripts/<name>.pdf + <name>.expected.json
//
// EVERYTHING HERE IS MADE UP. No real transcript was used or looked at. Names, student numbers,
// nationalities, NIDs, grades, dates and dean names are invented; the course codes are ordinary
// subject codes (the FCIT ones are from the public catalogue in src/catalog/fcit-2024-25.json).
// The made-up personal values are listed in MADE_UP_PERSONAL below: they are printed in the PDFs
// (so the privacy guard of Task 53 has something to catch) and never written to an expected file.
//
// No dependency: a minimal PDF writer (one Helvetica font, text drawn at x/y, one grey image for the
// scanned fixture). Deterministic: no dates, no random numbers, no /ID, so the same input always
// gives the same bytes.
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { catalogCourse } from '../src/catalog/fcit.js'

export const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'transcripts')

// The made-up personal values, one set per fixture. Never real, never in an expected file.
export const MADE_UP_PERSONAL = {
  'fcit-it-2p': { name: 'TEST STUDENT ALPHA', studentNo: '0000001', nationality: 'TESTLAND', nid: '0000000001' },
  'fcit-cs-1p': { name: 'TEST STUDENT BRAVO', studentNo: '0000002', nationality: 'SAMPLELAND', nid: '0000000002' },
  'fcit-is-3p': { name: 'TEST STUDENT CHARLIE', studentNo: '0000003', nationality: 'TESTLAND', nid: '0000000003' },
  'science-2p': { name: 'TEST STUDENT DELTA', studentNo: '0000004', nationality: 'MOCKLAND', nid: '0000000004' },
  'medicine-1p': { name: 'TEST STUDENT ECHO', studentNo: '0000005', nationality: 'TESTLAND', nid: '0000000005' },
  'transfer-tr': { name: 'TEST STUDENT FOXTROT', studentNo: '0000006', nationality: 'SAMPLELAND', nid: '0000000006' },
  'codes-mix': { name: 'TEST STUDENT GOLF', studentNo: '0000007', nationality: 'MOCKLAND', nid: '0000000007' },
  retake: { name: 'TEST STUDENT HOTEL', studentNo: '0000008', nationality: 'TESTLAND', nid: '0000000008' },
  'unknown-college': { name: 'TEST STUDENT INDIA', studentNo: '0000009', nationality: 'SAMPLELAND', nid: '0000000009' },
  scanned: { name: 'TEST STUDENT JULIET', studentNo: '0000010', nationality: 'MOCKLAND', nid: '0000000010' },
}

// ---- fixture definitions -------------------------------------------------------------------------
// A row is 'CODE NNN|DESCRIPTION|UA|UE|MARKS|LETTER' exactly as printed (irregular spaces in the code
// are kept in the PDF); an empty MARKS means the row has none (TR). Descriptions copy the registrar's
// style: upper case, abbreviations, typos, Roman numerals and digits.
const term = (header, rows, extra = []) => ({ kind: 'term', header, rows, extra })
const note = text => ({ kind: 'note', text })
const equivalent = rows => ({ kind: 'equivalent', rows })

export const FIXTURES = [
  {
    name: 'fcit-it-2p', covers: 'FCIT, IT major, 2 pages, quarter terms then semester terms, SEMESTER SYSTEM RE-ADOPTED',
    pages: 2, columns: [28, 306], colLines: 30, fontSize: 7, printDate: '12/01/2026', dean: 'DR. TEST DEAN ONE',
    student: { college: 'COMPUTING &amp; INFORMATION TECH.', collegeId: 'FCIT', major: 'INFORMATION TECHNOLOGY', degree: 'BACHELOR', status: 'ACTIVE', studyMode: 'REGULAR' },
    flow: [
      term('FALL 2020/2021 (QUARTER)', ['ELI 101|ENGLISH LANGUAGE I|2|2|91|A', 'MATH 110|GENERAL MATHEMATICS I|3|3|78|C+', 'ISLS 101|ISLAMIC CULTURE I|2|2|95|A+', 'COMM 101|COMMUNICATION SKILLS|2|2|86|B+']),
      term('WINTER 2020/2021 (QUARTER)', ['ELI 102|ENGLISH LANGUAGE II|2|2|88|B+', 'STAT 110|GENERAL STATISTICS I|3|3|82|B', 'CPIT 100|COMPUTER SKILS|3|3|97|A+', 'ARAB 101|ARABIC LANGUAGE I|2|2|90|A']),
      term('SPRING 2020/2021 (QUARTER)', ['ELI 103|ENGLISH LANGUAGE III|2|2|84|B', 'PHYS 110|GENERAL PHYSICS I|3|3|71|C', 'CPIT 110|PROGRAMMING I|3|3|92|A', 'BIOL 110|GENERAL BIOLOGY I|3|3|76|C+']),
      term('SUMMER 2020/2021 (QUARTER)', ['ELI 104|ENGLISH LANGUAGE IV|2|2|89|B+', 'ISLS   201|ISLAMIC CULTURE II|2|2|93|A']),
      term('FALL 2021/2022 (QUARTER)', ['CPIT 201|INTRO. TO COMPUTING|3|3|87|B+', 'CPCS 203|PROGRAMMING II|3|3|81|B', 'MATH 202|CALCULUS 2|3|3|67|D+', 'CPIT 221|TECHNICAL WRITTING|2|2|94|A']),
      term('WINTER 2021/2022 (QUARTER)', ['CPIT 210|COMPUTER ORGANIZATION|3|3|79|C+', 'CPIT 220|COMPUTER NETWORKS I|3|3|85|B+', 'CPIT 240|DATABASES I|3|3|90|A']),
      term('SPRING 2021/2022 (QUARTER)', ['CPIT 250|SYSTEM ANALYSIS & DESGIN|3|3|88|B+', 'CPIT 251|SOFTWARE ENGINEERING I|3|3|83|B', 'CPIT 260|OPERATING SYSTEMS|3|3|74|C', 'ARAB 201|ARABIC LANGUAGE II|2|2|96|A+']),
      note('SEMESTER SYSTEM RE-ADOPTED'),
      term('FALL 2022/2023', ['CPIT 252|SOFTWARE DESIGN PATTERNS|3|3|91|A', 'CPIT 305|ADV. PROGRAMMING|3|3|86|B+', 'CPIT 330|IT ISSUES & MGMT|3|3|80|B', 'CPIT 340|DATABASE II|3|3|77|C+', 'CPIT 370|COMPUTER NETWORKS II|3|3|62|D'], ['Quarter', 'Semester']),
      term('SPRING 2022/2023', ['CPIT 425|INFORMATION SECURITY|3|3|93|A', 'CPIT 435|NEEDS ASSESS. & TECH. EVAL.|3|3|88|B+', 'CPIT 380|MULTIMEDIA TECHNOLOGY|3|3|84|B', 'CPIT 405|INTERNET APPL.|3|3|90|A']),
      term('FALL 2023/2024', ['CPIT 455|SOFTWARE ENGINEERING II|3|3|87|B+', 'CPIT 498|SENIOR PROJECT I|2|2|95|A+', 'ISLS 301|ISLAMIC CULTURE III|2|2|91|A', 'CPIT 470|IT PROJECT MGMT.|3|3|72|C']),
      term('SPRING 2023/2024', ['CPIT 499|SENIOR PROJECT II|4|4|96|A+', 'CPIT 490|SPECIAL TOPICS IN IT|3|3|89|B+', 'ISLS 401|ISLAMIC CULTURE IV|2|2|85|B+']),
    ],
  },
  {
    name: 'fcit-cs-1p', covers: 'FCIT, CS major, 1 page',
    pages: 1, columns: [40, 318], colLines: 26, fontSize: 6.5, printDate: '03/02/2026', dean: 'DR. TEST DEAN TWO',
    student: { college: 'COMPUTING AND INFORMATION TECHNOLOGY', collegeId: 'FCIT', major: 'COMPUTER SCIENCE', degree: 'BACHELOR', status: 'ACTIVE' },
    flow: [
      term('FALL 2021/2022', ['ELI 101|ENGLISH LANGUAGE I|2|2|85|B+', 'MATH 110|GENERAL MATH. I|3|3|90|A', 'CPIT 110|PROGRAMMING I|3|3|45|F', 'ISLS 101|ISLAMIC CULTURE I|2|2|88|B+']),
      term('SPRING 2021/2022', ['ELI 102|ENGLISH LANGUAGE II|2|2|92|A', 'CPCS 202|PROGRAMMING I|3|3|81|B', 'PHYS 110|GENERAL PHYSICS I|3|3|69|D+', 'STAT 110|GENERAL STATISTICS I|3|3|87|B+']),
      term('FALL 2022/2023', ['CPCS 203|PROGRAMMING II|3|3|84|B', 'CPCS 211|DIGITAL LOGIC DESIGN|3|3|76|C+', 'CPCS 222|DISCRETE STRUCTURES I|3|3|90|A', 'MATH 202|CALCULUS 2|3|3|73|C']),
      term('SPRING 2022/2023', ['CPCS 204|DATA STRUCTURES I|3|3|88|B+', 'CPCS  241|DATABASES I|3|3|95|A+', 'CPCS 214|COMPUTER ORGANISATION|3|3|80|B', 'ARAB 101|ARABIC LANGUAGE I|2|2|91|A']),
      term('FALL 2023/2024', ['CPCS 351|SOFTWARE ENGINEERING 1|3|3|86|B+', 'CPCS 361|OPERATING SYS. I|3|3|78|C+', 'CPCS 324|ALGORITHMS & DATA STRUCT. II|3|3|83|B', 'CPCS 425|INFORMATON SECURITY|3|3|91|A']),
    ],
  },
  {
    name: 'fcit-is-3p', covers: 'FCIT, IS major, 3 pages, a term that continues onto the next column',
    pages: 3, columns: [24, 300], colLines: 24, fontSize: 7, printDate: '20/01/2026', dean: 'DR. TEST DEAN THREE', mustSplitTerm: true,
    student: { college: 'FACULTY OF COMPUTING & INFORMATION TECHNOLOGY', collegeId: 'FCIT', major: 'INFORMATION SYSTEMS', degree: 'BACHELOR', status: 'GRADUATED' },
    flow: [
      term('FALL 2018/2019', ['ELI 101|ENGLISH LANGUAGE I|2|2|80|B', 'MATH 110|GENERAL MATHEMATICS I|3|3|85|B+', 'ISLS 101|ISLAMIC CULTURE I|2|2|97|A+', 'COMM 101|COMMUNICATION SKILLS|2|2|92|A', 'CPIT 100|COMPUTER SKILLS|3|3|88|B+']),
      term('SPRING 2018/2019', ['ELI 102|ENGLISH LANGUAGE II|2|2|86|B+', 'STAT 110|GENERAL STATISTICS I|3|3|79|C+', 'CPIT 110|PROGRAMMING I|3|3|91|A', 'BIOL 110|GENERAL BIOLOGY I|3|3|74|C', 'ARAB 101|ARABIC LANGUAGE I|2|2|94|A']),
      term('SUMMER 2018/2019', ['ELI 103|ENGLISH LANGUAGE III|2|2|89|B+', 'ELI 104|ENGLISH LANGUAGE IV|2|2|90|A']),
      term('FALL 2019/2020', ['CPIS 220|INTRO. TO INFORMATION SYSTEMS|3|3|93|A', 'CPCS 203|PROGRAMMING II|3|3|77|C+', 'MATH 202|CALCULUS 2|3|3|64|D', 'CPIS 222|DISCRETE STRUCT. FOR IS|3|3|82|B', 'ISLS 201|ISLAMIC CULTURE II|2|2|95|A+']),
      term('SPRING 2019/2020', ['CPIS 240|DATABASE MGMT. SYSTEMS I|3|3|90|A', 'CPIS 250|SOFTWARE ENGINEERING|3|3|87|B+', 'CPIS 210|COMPUTER ORGANIZATION|3|3|71|C', 'CPIS 260|E-BUSINESS FUNDAMENTALS|3|3|84|B']),
      term('FALL 2020/2021', ['CPIS 312|INFORMATION & COMP. SECURITY|3|3|88|B+', 'CPIS 320|NETWORK FUNDAMENTALS|3|3|79|C+', 'CPIS 334|PROJECT MANAGMENT|3|3|92|A', 'ARAB 201|ARABIC LANGUAGE II|2|2|86|B+']),
      term('SPRING 2020/2021', ['CPIS 340|DATABASE MGMT. SYSTEMS II|3|3|83|B', 'CPIS 350|SYSTEMS DESIGN PATTERNS|3|3|90|A', 'CPIS 351|IS ANALYSIS & ARCH. DESIGN|3|3|86|B+', 'CPIS 330|ADV. PROJECT & QUALITY MGMT|3|3|81|B']),
      term('SUMMER 2020/2021', ['CPIS 323|PRACTICAL TRAINING|2|2|96|A+']),
      term('FALL 2021/2022', ['CPIS 352|IS APPL. DESIGN & DEVELOPMENT|3|3|89|B+', 'CPIS 360|ADV. INFO. SYSTEMS TECH.|3|3|94|A', 'CPIS 380|DECISION SUPPORT SYSTEMS|3|3|78|C+', 'ISLS 301|ISLAMIC CULTURE III|2|2|90|A']),
      term('SPRING 2021/2022', ['CPIS 428|PROFESSIONAL ETHICS|2|2|95|A+', 'CPIS 434|IS STRATEGY & MGMT|3|3|85|B+', 'CPIS 498|SENIOR PROJECT I|2|2|93|A', 'CPIS 370|HUMAN COMPUTER INTERACTION|3|3|80|B']),
      term('FALL 2022/2023', ['CPIS 499|SENIOR PROJECT II|4|4|97|A+', 'CPIS 487|DATA MINING|3|3|88|B+', 'ISLS 401|ISLAMIC CULTURE IV|2|2|84|B', 'CPIS 422|INFO. SYSTEMS AUDIT|3|3|76|C+']),
      term('SPRING 2022/2023', ['CPIS 465|ENTERPRISE RESOURCE PLANNING|3|3|91|A', 'CPIS 483|BUSINESS INTELLIGENCE|3|3|87|B+', 'CPIS 490|SELECTED TOPICS IN IS|3|3|93|A']),
    ],
  },
  {
    name: 'science-2p', covers: "Faculty of Science student; college text in the registrar's short form",
    pages: 2, columns: [32, 314], colLines: 24, fontSize: 7, printDate: '28/12/2025', dean: 'DR. TEST DEAN FOUR',
    student: { college: 'FACULTY OF SCI.', collegeId: 'SCI', major: 'MATHEMATICS', degree: 'BACHELOR', status: 'ACTIVE', studyMode: 'REGULAR' },
    flow: [
      term('FALL 2020/2021', ['ELI 101|ENGLISH LANGUAGE I|2|2|83|B', 'MATH 110|GENERAL MATHEMATICS I|3|3|96|A+', 'CHEM 110|GENERAL CHEMISTRY I|3|3|72|C', 'ISLS 101|ISLAMIC CULTURE I|2|2|90|A']),
      term('SPRING 2020/2021', ['ELI 102|ENGLISH LANGUAGE II|2|2|87|B+', 'PHYS 110|GENERAL PHYSICS I|3|3|81|B', 'STAT 110|GENERAL STATISTICS I|3|3|94|A', 'BIOL 110|GENERAL BIOLOGY I|3|3|68|D+']),
      term('FALL 2021/2022', ['MATH 202|CALCULUS 2|3|3|91|A', 'MATH 241|LINEAR ALGEBRA I|3|3|88|B+', 'PHYS 202|GENERAL PHYSICS II|4|4|75|C+', 'ARAB 101|ARABIC LANGUAGE I|2|2|93|A']),
      term('SPRING 2021/2022', ['MATH 203|CALCULUS III|3|3|85|B+', 'MATH 231|DIFFERENTIAL EQUATIONS I|3|3|79|C+', 'MATH 263|INTRO. TO FOUNDATIONS OF MATH|3|3|90|A', 'ISLS 201|ISLAMIC CULTURE II|2|2|86|B+']),
      term('SUMMER 2021/2022', ['MATH 291|NUMERICAL ANALYSIS I|3|3|82|B']),
      term('FALL 2022/2023', ['MATH 342|ABSTRACT ALGEBRA I|3|3|77|C+', 'MATH 361|REAL ANALYSIS I|3|3|70|C', 'STAT 210|PROBABILITY THEORY|3|3|89|B+', 'ARAB 201|ARABIC LANGUAGE II|2|2|95|A+']),
      term('SPRING 2022/2023', ['MATH 343|ABSTRACT ALGEBRA II|3|3|84|B', 'MATH 362|REAL ANALYSIS II|3|3|73|C', 'MATH 371|COMPLEX ANALYSIS I|3|3|80|B', 'ISLS 301|ISLAMIC CULTURE III|2|2|92|A']),
      term('FALL 2023/2024', ['MATH 451|TOPOLOGY I|3|3|87|B+', 'MATH 499|GRADUATION PROJECT|2|2|98|A+', 'ISLS 401|ISLAMIC CULTURE IV|2|2|88|B+']),
    ],
  },
  {
    name: 'medicine-1p', covers: 'Faculty of Medicine student, 1 page',
    pages: 1, columns: [26, 296], colLines: 30, fontSize: 7, printDate: '05/01/2026', dean: 'DR. TEST DEAN FIVE',
    student: { college: 'FACULTY OF MEDICINE', collegeId: 'MED', major: 'MEDICINE AND SURGERY', degree: 'BACHELOR', status: 'ACTIVE' },
    flow: [
      term('FALL 2021/2022', ['ELI 101|ENGLISH LANGUAGE I|2|2|95|A+', 'BIOL 110|GENERAL BIOLOGY I|3|3|97|A+', 'CHEM 110|GENERAL CHEMISTRY I|3|3|93|A', 'PHYS 110|GENERAL PHYSICS I|3|3|89|B+', 'ISLS 101|ISLAMIC CULTURE I|2|2|90|A']),
      term('SPRING 2021/2022', ['ELI 102|ENGLISH LANGUAGE II|2|2|92|A', 'CHEM 281|ORGANIC CHEM. FOR MED.|3|3|86|B+', 'MATH 110|GENERAL MATHEMATICS I|3|3|91|A', 'COMM 101|COMMUNICATION SKILLS|2|2|94|A']),
      term('FALL 2022/2023', ['ANAT 213|GROSS ANATOMY I|5|5|88|B+', 'PHSL 211|PHYSIOLOGY I|4|4|90|A', 'BCHM 211|BIOCHEMISTRY I|4|4|84|B', 'ARAB 101|ARABIC LANGUAGE I|2|2|96|A+']),
      term('SPRING 2022/2023', ['ANAT 214|GROSS ANATOMY II|5|5|91|A', 'PHSL 212|PHYSIOLOGY II|4|4|87|B+', 'MICR 231|MED. MICROBIOLOGY I|3|3|79|C+', 'ISLS 201|ISLAMIC CULTURE II|2|2|93|A']),
    ],
  },
  {
    name: 'transfer-tr', covers: 'EQUIVALENT COURSES with several TR rows (no marks), then KAU terms',
    pages: 1, columns: [30, 310], colLines: 28, fontSize: 7, printDate: '18/01/2026', dean: 'DR. TEST DEAN SIX',
    student: { college: 'COMPUTING & INFO. TECH.', collegeId: 'FCIT', major: 'INFORMATION TECHNOLOGY', degree: 'BACHELOR', status: 'ACTIVE' },
    flow: [
      equivalent(['ELI 101|ENGLISH LANGUAGE I|2|2||TR', 'ELI 102|ENGLISH LANGUAGE II|2|2||TR', 'MATH 110|GENERAL MATHEMATICS I|3|3||TR', 'STAT 110|GENERAL STATISTICS I|3|3||TR', 'CPIT 110|PROGRAMMING I|3|3||TR']),
      term('FALL 2022/2023', ['CPIT 201|INTRO. TO COMPUTING|3|3|84|B', 'CPIT 240|DATABASES I|3|3|91|A', 'ISLS 101|ISLAMIC CULTURE I|2|2|88|B+', 'MATH 202|CALCULUS 2|3|3|75|C+']),
      term('SPRING 2022/2023', ['CPIT 250|SYSTEM ANALYSIS & DESIGN|3|3|86|B+', 'CPIT 251|SOFTWARE ENG. I|3|3|80|B', 'ARAB 101|ARABIC LANGUAGE I|2|2|93|A']),
      term('FALL 2023/2024', ['CPIT 260|OPERATING SYSTEMS|3|3|78|C+', 'CPIT 305|ADVANCED PROGRAMMING|3|3|89|B+', 'ISLS 201|ISLAMIC CULTURE II|2|2|95|A+']),
    ],
  },
  {
    name: 'codes-mix', covers: 'NP with 0 credits (summer training), W, IC, IP, P, WF, DN, NF and one unknown code (ZZ)',
    pages: 1, columns: [36, 300], colLines: 30, fontSize: 7, printDate: '09/01/2026', dean: 'DR. TEST DEAN SEVEN',
    student: { college: 'COMPUTING & INFORMATION TECH', collegeId: 'FCIT', major: 'INFORMATION TECHNOLOGY', degree: 'BACHELOR', status: 'ACTIVE', studyMode: 'PART TIME' },
    flow: [
      term('FALL 2021/2022', ['ELI 101|ENGLISH LANGUAGE I|2|2|88|B+', 'MATH 110|GENERAL MATHEMATICS I|3|0|W|W', 'CPIT 110|PROGRAMMING I|3|3|91|A', 'ISLS 101|ISLAMIC CULTURE I|2|2|85|B+']),
      term('SPRING 2021/2022', ['ELI 102|ENGLISH LANGUAGE II|2|2|84|B', 'STAT 110|GENERAL STATISTICS I|3|0|WF|WF', 'PHYS 110|GENERAL PHYSICS I|3|0|DN|DN', 'ARAB 101|ARABIC LANGUAGE I|2|2|90|A']),
      term('SUMMER 2021/2022', ['CPIT 290|SUMMER TRAINING|0|0|NP|NP']),
      term('FALL 2022/2023', ['CPIT 240|DATABASES I|3|3|38|NF', 'CPIT 250|SYSTEM ANALYSIS & DESIGN|3|3|ZZ|ZZ', 'CPIS 334|PROJECT MANAGEMENT|3|3|IC|IC', 'COMM 101|COMMUNICATION SKILLS|2|2|P|P']),
      term('SPRING 2022/2023', ['CPIT 251|SOFTWARE ENGINEERING I|3|0|IP|IP', 'CPIT 260|OPERATING SYSTEMS|3|0|IP|IP', 'ISLS 201|ISLAMIC CULTURE II|2|0|IP|IP']),
    ],
  },
  {
    name: 'retake', covers: 'the same code twice: F, then B+ in a later term', retakes: true,
    pages: 1, columns: [44, 318], colLines: 22, fontSize: 7, printDate: '14/01/2026', dean: 'DR. TEST DEAN EIGHT',
    student: { college: 'COMPUTING AND INFORMATION TECH.', collegeId: 'FCIT', major: 'INFORMATION TECHNOLOGY', degree: 'BACHELOR', status: 'ACTIVE' },
    flow: [
      term('FALL 2021/2022', ['CPIT  240|DATABASES I|3|3|52|F', 'ELI 101|ENGLISH LANGUAGE I|2|2|90|A', 'ISLS 101|ISLAMIC CULTURE I|2|2|85|B+', 'MATH 110|GENERAL MATHEMATICS I|3|3|77|C+']),
      term('SPRING 2021/2022', ['CPIT 250|SYSTEM ANALYSIS & DESIGN|3|3|82|B', 'ARAB 101|ARABIC LANGUAGE I|2|2|94|A', 'STAT 110|GENERAL STATISTICS I|3|3|88|B+']),
      term('FALL 2022/2023', ['CPIT 240|DATABASES I|3|3|87|B+', 'CPIT 251|SOFTWARE ENGINEERING I|3|3|91|A', 'ISLS 201|ISLAMIC CULTURE II|2|2|80|B']),
    ],
  },
  {
    name: 'unknown-college', covers: 'a college text that matches no known college (FCIT, SCI, MED)',
    pages: 1, columns: [34, 306], colLines: 26, fontSize: 7, printDate: '22/01/2026', dean: 'DR. TEST DEAN NINE',
    student: { college: 'FACULTY OF ECONOMICS & ADMIN.', collegeId: null, major: 'ACCOUNTING', degree: 'BACHELOR', status: 'ACTIVE' },
    flow: [
      term('FALL 2022/2023', ['ELI 101|ENGLISH LANGUAGE I|2|2|91|A', 'ECON 101|PRINCIPLES OF ECONOMICS I|3|3|86|B+', 'ACCT 210|FINANCIAL ACCOUNTING I|3|3|79|C+', 'ISLS 101|ISLAMIC CULTURE I|2|2|93|A']),
      term('SPRING 2022/2023', ['ELI 102|ENGLISH LANGUAGE II|2|2|84|B', 'ACCT 211|FINANCIAL ACCOUNTING II|3|3|88|B+', 'MGT 201|PRINCIPLES OF MGMT|3|3|90|A', 'LA 101|INTRO. TO LAW|2|2|92|A', 'STAT 110|GENERAL STATISTICS I|3|3|71|C']),
      term('FALL 2023/2024', ['ACCT 301|COST ACCOUNTING|3|3|83|B', 'FIN 201|INTRO. TO FINANCE|3|3|76|C+', 'ARAB 101|ARABIC LANGUAGE I|2|2|95|A+']),
    ],
  },
  {
    name: 'scanned', covers: 'an image-only page (no text layer)', scanned: true,
    pages: 1, printDate: '02/02/2026', dean: 'DR. TEST DEAN TEN',
    student: { college: 'COMPUTING &amp; INFORMATION TECH.', collegeId: 'FCIT', major: 'INFORMATION TECHNOLOGY', degree: 'BACHELOR', status: 'ACTIVE' },
    flow: [],
  },
]

// ---- rows, terms and the made-up GPA -------------------------------------------------------------
const LETTER_BAND = { 'A+': [95, 100], A: [90, 94], 'B+': [85, 89], B: [80, 84], 'C+': [75, 79], C: [70, 74], 'D+': [65, 69], D: [60, 64], F: [0, 59] }
// Made-up 5-point scale, only to print plausible "Term"/"Cumulative"/"Cumulative GPA" lines.
const GRADE_POINTS = { 'A+': 5, A: 4.75, 'B+': 4.5, B: 4, 'C+': 3.5, C: 3, 'D+': 2.5, D: 2, F: 1, DN: 1, WF: 1, NF: 1 }

const canonical = printed => printed.trim().split(/\s+/).join('-')

function parseRow(text, ctx) {
  const [printedCode, description, ua, ue, marks, letter] = text.split('|')
  if (!/^[A-Z]{2,4}\s+\d{3}$/.test(printedCode) || !description || !letter) throw new Error(`bad row: ${text}`)
  if (description.length > 29) throw new Error(`description too long for the column: ${description}`)
  if (/^\d+$/.test(marks) && LETTER_BAND[letter] && (Number(marks) < LETTER_BAND[letter][0] || Number(marks) > LETTER_BAND[letter][1])) throw new Error(`marks do not fit the letter: ${text}`)
  const code = canonical(printedCode)
  return {
    printed: { code: printedCode, description, ua, ue, marks, letter },
    expected: {
      code,
      credits: { ua: Number(ua), ue: Number(ue) },
      marks: marks === '' ? null : /^\d+$/.test(marks) ? Number(marks) : marks,
      letter,
      term: ctx.term, year: ctx.year, system: ctx.system, section: ctx.section,
      retaken: false,
      inCourseMap: !!catalogCourse(code),
    },
  }
}

function parseTermHeader(header) {
  const m = /^(FALL|WINTER|SPRING|SUMMER) (\d{4}\/\d{4})( \(QUARTER\))?$/.exec(header)
  if (!m) throw new Error(`bad term header: ${header}`)
  return { term: m[1], year: m[2], system: m[3] ? 'quarter' : 'semester' }
}

const sum = (rows, f) => rows.reduce((t, r) => t + f(r), 0)
function totals(rows) {
  const graded = rows.filter(r => r.expected.letter in GRADE_POINTS)
  const gpaCredits = sum(graded, r => r.expected.credits.ua)
  const points = sum(graded, r => GRADE_POINTS[r.expected.letter] * r.expected.credits.ua)
  return { ua: sum(rows, r => r.expected.credits.ua), ue: sum(rows, r => r.expected.credits.ue), points: points.toFixed(2), gpa: (gpaCredits ? points / gpaCredits : 0).toFixed(2) }
}

// Turns a fixture's flow into printed lines (in reading order) and the expected rows.
function buildLines(def) {
  const lines = []; const rows = []; const kauRows = []; const transferRows = []
  for (const block of def.flow) {
    if (block.kind === 'note') { lines.push({ kind: 'note', text: block.text }); continue }
    if (block.kind === 'equivalent') {
      lines.push({ kind: 'heading', text: 'EQUIVALENT COURSES' })
      const parsed = block.rows.map(r => parseRow(r, { term: null, year: null, system: null, section: 'equivalent' }))
      parsed.forEach(r => { lines.push({ kind: 'row', row: r }); rows.push(r); transferRows.push(r) })
      const t = totals(parsed)
      lines.push({ kind: 'summary', label: 'Transfer Equivalency', values: [t.ua, t.ue, '', ''] }, { kind: 'blank' })
      continue
    }
    const ctx = { ...parseTermHeader(block.header), section: 'term' }
    lines.push({ kind: 'heading', text: block.header, termKey: block.header })
    const parsed = block.rows.map(r => parseRow(r, ctx))
    parsed.forEach(r => { lines.push({ kind: 'row', row: r, termKey: block.header }); rows.push(r); kauRows.push(r) })
    const t = totals(parsed); const c = totals(kauRows)
    lines.push({ kind: 'summary', label: 'Term', values: [t.ua, t.ue, t.points, t.gpa], termKey: block.header })
    lines.push({ kind: 'summary', label: 'Cumulative', values: [c.ua, c.ue, c.points, c.gpa], termKey: block.header })
    for (const label of block.extra) {
      // Quarter credits so far and the same credits as semester credits (made up: two thirds).
      const quarterUa = totals(kauRows.filter(r => r.expected.system === 'quarter')).ua
      lines.push({ kind: 'summary', label, values: label === 'Quarter' ? [quarterUa, quarterUa, '', ''] : [Math.round(quarterUa * 2 / 3), Math.round(quarterUa * 2 / 3), '', ''], termKey: block.header })
    }
    lines.push({ kind: 'blank' })
  }
  // Retakes: every attempt except the latest is marked retaken (rows are already in term order).
  const lastIndex = new Map(rows.map((r, i) => [r.expected.code, i]))
  if (!def.retakes && lastIndex.size !== rows.length) throw new Error(`${def.name}: a code repeats but the fixture is not about retakes`)
  rows.forEach((r, i) => { r.expected.retaken = lastIndex.get(r.expected.code) !== i })

  const all = totals(kauRows); const tr = totals(transferRows)
  const checkGpa = def.flow.length ? all.gpa : null
  if (def.flow.length) {
    lines.push({ kind: 'summary', label: 'Cumulative Total', values: [all.ua, all.ue, all.points, all.gpa] })
    lines.push({ kind: 'summary', label: 'Transferred Total', values: [tr.ua, tr.ue, '', ''] })
    lines.push({ kind: 'summary', label: 'Grand Total', values: [all.ua + tr.ua, all.ue + tr.ue, all.points, all.gpa] })
    lines.push({ kind: 'summary', label: 'Cumulative GPA', values: ['', '', '', checkGpa] })
    lines.push({ kind: 'note', text: 'End of Transcript' })
  }
  return { lines, rows, checkGpa }
}

// Flows the lines down the left column, then the right column, then the next page.
function paginate(def, lines) {
  const pages = [[]]; let column = 0; let slot = 0; const termColumns = new Map()
  for (const line of lines) {
    if (slot === def.colLines) { slot = 0; column += 1; if (column === 2) { column = 0; pages.push([]) } }
    if (line.kind === 'blank') { if (slot) slot += 1; continue }
    pages.at(-1).push({ ...line, column, slot })
    if (line.termKey) termColumns.set(line.termKey, new Set([...(termColumns.get(line.termKey) || []), `${pages.length}:${column}`]))
    slot += 1
  }
  return { pages, splitTerms: [...termColumns].filter(([, cols]) => cols.size > 1).map(([key]) => key) }
}

// ---- drawing ---------------------------------------------------------------------------------------
const PAGE = { w: 595, h: 842 }
const AREA = { top: 700, bottom: 92 }
const CELL = { code: 0, description: 40, ua: 176, ue: 192, marks: 208, letter: 236 }
const num = n => (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, '')
const pdfText = s => {
  if (!/^[\x20-\x7e]*$/.test(s)) throw new Error(`non-ASCII text: ${s}`)
  return `(${s.replace(/[\\()]/g, m => `\\${m}`)})`
}
const text = (x, y, s, size) => (s === '' ? '' : `BT /F1 ${num(size)} Tf 1 0 0 1 ${num(x)} ${num(y)} Tm ${pdfText(String(s))} Tj ET\n`)

function drawPage(def, personal, items, pageNo, pageCount) {
  const [left, right] = def.columns; const size = def.fontSize
  let ops = ''
  ops += text(220, 814, 'ACADEMIC TRANSCRIPT', 9)
  ops += text(196, 803, 'SYNTHETIC TEST DATA - NOT A REAL RECORD', 7)
  ops += text(left, 784, 'STUDENT INFORMATION', 8)
  const s = def.student
  const pairs = [['NAME', personal.name, 'STUDENT NO', personal.studentNo], ['NATIONALITY', personal.nationality, 'NID', personal.nid],
    ['COLLEGE', s.college, 'MAJOR', s.major], ['DEGREE', s.degree, 'STATUS', s.status]]
  if (s.studyMode) pairs.push(['STUDY MODE', s.studyMode, '', ''])
  pairs.forEach(([l1, v1, l2, v2], i) => {
    const y = 771 - i * 11
    ops += text(left, y, l1, size) + text(left + 52, y, v1, size) + text(right, y, l2, size) + text(right + 52, y, v2, size)
  })
  const lineHeight = (AREA.top - AREA.bottom) / (def.colLines - 1)
  for (const item of items) {
    const x0 = def.columns[item.column]; const y = AREA.top - item.slot * lineHeight
    if (item.kind === 'heading' || item.kind === 'note') ops += text(x0, y, item.text, size)
    else if (item.kind === 'row') {
      const p = item.row.printed
      ops += text(x0 + CELL.code, y, p.code, size) + text(x0 + CELL.description, y, p.description, size)
        + text(x0 + CELL.ua, y, p.ua, size) + text(x0 + CELL.ue, y, p.ue, size) + text(x0 + CELL.marks, y, p.marks, size) + text(x0 + CELL.letter, y, p.letter, size)
    } else if (item.kind === 'summary') {
      const [ua, ue, points, gpa] = item.values
      ops += text(x0 + CELL.description, y, item.label, size) + text(x0 + CELL.ua, y, ua, size) + text(x0 + CELL.ue, y, ue, size)
        + text(x0 + CELL.marks, y, points, size) + text(x0 + CELL.letter, y, gpa, size)
    }
  }
  ops += text(left, 52, `Print Date: ${def.printDate}`, size)
  ops += text(268, 52, `Page ${pageNo} of ${pageCount}`, size)
  ops += text(right + 110, 52, 'Dean of Admission', size)
  ops += text(right + 110, 42, def.dean, size)
  return ops
}

// A grey "photo" of a page: light background, dark bars where text lines would be. No text layer.
function scannedImage() {
  const w = 298; const h = 421; const data = Buffer.alloc(w * h, 0xf2)
  const bar = (x, y, len) => { for (let yy = y; yy < y + 3; yy += 1) for (let xx = x; xx < Math.min(w, x + len); xx += 1) data[yy * w + xx] = 0x30 }
  bar(110, 12, 80)
  for (let i = 0; i < 5; i += 1) { bar(14, 34 + i * 7, 60); bar(152, 34 + i * 7, 55) }
  for (let col = 0; col < 2; col += 1) for (let i = 0; i < 44; i += 1) {
    const y = 84 + i * 7; const x = 14 + col * 140
    if (i % 9 === 0) bar(x, y, 50); else if (i % 9 < 7) { bar(x, y, 18); bar(x + 21, y, 30 + ((i * 7 + col * 3) % 25)); bar(x + 90, y, 22) }
  }
  bar(14, 400, 50); bar(132, 400, 30); bar(210, 400, 50)
  return { w, h, data: deflateSync(data, { level: 9 }) }
}

// The minimal PDF writer: catalog, page tree, one Helvetica font, one content stream per page.
export function writePdf(pages) {
  const objects = []
  const add = body => { objects.push(body); return objects.length }
  const catalog = add(null); const tree = add(null)
  const font = add(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', 'latin1'))
  const stream = (dict, data) => Buffer.concat([Buffer.from(`<< ${dict}/Length ${data.length} >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')])
  const kids = []
  for (const page of pages) {
    let resources = `/Font << /F1 ${font} 0 R >>`; let ops = page.ops
    if (page.image) {
      const im = add(stream(`/Type /XObject /Subtype /Image /Width ${page.image.w} /Height ${page.image.h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode `, page.image.data))
      resources = `/XObject << /Im1 ${im} 0 R >>`; ops = `q ${PAGE.w} 0 0 ${PAGE.h} 0 0 cm /Im1 Do Q\n`
    }
    const content = add(stream('', Buffer.from(ops, 'latin1')))
    kids.push(add(Buffer.from(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << ${resources} >> /Contents ${content} 0 R >>`, 'latin1')))
  }
  objects[catalog - 1] = Buffer.from(`<< /Type /Catalog /Pages ${tree} 0 R >>`, 'latin1')
  objects[tree - 1] = Buffer.from(`<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`, 'latin1')

  const chunks = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]; const offsets = []
  let length = chunks[0].length
  objects.forEach((body, i) => {
    offsets.push(length)
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), body, Buffer.from('\nendobj\n', 'latin1')])
    chunks.push(chunk); length += chunk.length
  })
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${length}\n%%EOF\n`, 'latin1'))
  return Buffer.concat(chunks)
}

// One fixture → { pdf, expected }. Throws when the layout does not give what the definition promises.
export function buildFixture(def) {
  const personal = MADE_UP_PERSONAL[def.name]
  if (!personal) throw new Error(`no made-up personal values for ${def.name}`)
  const student = { collegeRaw: def.student.college, collegeId: def.student.collegeId, majorRaw: def.student.major, degreeRaw: def.student.degree, statusRaw: def.student.status, studyModeRaw: def.student.studyMode ?? null }
  const header = { fixture: def.name, madeUp: 'Synthetic, made-up data from scripts/make-transcript-fixtures.mjs (Task 50). Do not edit by hand; run npm run fixtures:transcripts.', covers: def.covers, pages: def.pages, scanned: !!def.scanned }
  if (def.scanned) {
    return { pdf: writePdf([{ image: scannedImage() }]), expected: { ...header, student: null, checkGpa: null, rows: [] } }
  }
  const { lines, rows, checkGpa } = buildLines(def)
  const { pages, splitTerms } = paginate(def, lines)
  if (pages.length !== def.pages) throw new Error(`${def.name}: ${pages.length} pages, expected ${def.pages}`)
  if (!pages[0].some(i => i.column === 1)) throw new Error(`${def.name}: page 1 does not use its right column`)
  if (def.mustSplitTerm && !splitTerms.length) throw new Error(`${def.name}: no term continues onto the next column`)
  const pdf = writePdf(pages.map((items, i) => ({ ops: drawPage(def, personal, items, i + 1, pages.length) })))
  return { pdf, expected: { ...header, student, checkGpa, rows: rows.map(r => r.expected) }, splitTerms }
}

// Pretty JSON with one row per line, so a row read aloud from the PDF is easy to find.
export function expectedJson({ rows, ...rest }) {
  const head = JSON.stringify(rest, null, 2).replace(/\n}$/, '')
  const body = rows.length ? `\n${rows.map(r => `    ${JSON.stringify(r)}`).join(',\n')}\n  ` : ''
  return `${head},\n  "rows": [${body}]\n}\n`
}

function main() {
  mkdirSync(FIXTURE_DIR, { recursive: true })
  for (const def of FIXTURES) {
    const { pdf, expected, splitTerms } = buildFixture(def)
    writeFileSync(path.join(FIXTURE_DIR, `${def.name}.pdf`), pdf)
    writeFileSync(path.join(FIXTURE_DIR, `${def.name}.expected.json`), expectedJson(expected))
    console.log(`${def.name}: ${def.pages} page(s), ${expected.rows.length} rows, ${pdf.length} bytes${splitTerms?.length ? `, continues onto the next column: ${splitTerms.join(', ')}` : ''}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
