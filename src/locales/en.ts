export const en = {
  appName: 'Chairside',
  tagline: 'Your slides become patients.',

  // Tablet / schedule
  todaySchedule: "Today's schedule",
  clinicDay: 'Clinic Day',
  chooseDay: 'Pick a clinic day',
  demoBadge: 'Demo content — verify against your syllabus',
  importTitle: 'Import a lecture',

  // Sign in / character select
  loginTitle: 'Who are you today?',
  loginBlurb: 'Pick your name and the clinician you play as. Your choice sets your track.',
  yourName: 'Your name',
  yourNamePlaceholder: 'e.g. Yaman',
  chooseCharacter: 'Choose your clinician',
  chooseCharacterHint: 'Dentists run the dental clinic; physicians run the medical one.',
  trackDental: 'Dentistry',
  trackMedical: 'Medicine',
  startShift: 'Start your shift',

  // Subject
  chooseSubject: 'Subject',
  chooseSubjectHint: 'Pick what you are studying. Import a lecture to add your own.',
  noSubjects: 'Nothing here yet',
  noSubjectsHint: 'Import one of your lectures and it becomes a clinic day you can play.',
  dayCount: '{n} clinic day(s)',
  allSubjects: 'Show everything',
  changeSubject: 'Change subject',
  signOut: 'Sign out',
  profileTitle: 'Your profile',

  // First-person clinic
  enterClinic: 'Enter the clinic',
  classicMode: 'Open without 3D',
  exitClinic: 'Leave',
  clickToLook: 'Click to look around',
  moveHint: 'WASD or arrows to walk · E to interact · Esc to leave',
  backToRoom: 'Back to the room',
  promptStudy: 'Study at the desk',
  promptStudyAgain: 'Review your notes again',
  promptSolve: 'See the patient',
  promptDrawerOpen: 'Open the drawer',
  promptDrawerClose: 'Close the drawer',
  promptBoard: 'Check your reputation',
  boardReading: '{streak} day streak · {coins} coins',
  generatedBadge: 'From {file} — verify against your syllabus',
  streakLabel: 'Day streak',
  coinsLabel: 'Coins',
  start: 'Start',
  continue: 'Continue',
  replay: 'Play again',
  best: 'Best',

  // Missions
  morning: 'Morning',
  afternoon: 'Afternoon',
  prepMission: 'PREP',
  treatMission: 'TREAT',
  locked: 'Locked',
  completed: 'Done',

  // Prep
  chunkOf: 'Card {n} of {total}',
  checkAnswer: 'Check',
  next: 'Next',
  correct: 'Correct',
  notQuite: 'Not quite',
  source: 'Source',

  // Treat
  chiefComplaint: 'Chief complaint',
  history: 'History',
  findings: 'Findings',
  decisionOf: 'Decision {n} of {total}',
  seePatient: 'See the patient',
  continueCase: 'Continue',

  // Day close
  clinicClosed: 'Clinic closed',
  score: 'Score',
  coinsEarned: 'Coins earned',
  streakNow: 'Streak',
  days: 'days',
  backToTablet: 'Back to schedule',
  reviewMissed: 'What you missed',
  nothingMissed: 'Nothing missed. Clean day.',

  // Misc
  language: 'العربية',
  loading: 'Loading…',
} as const

export type TranslationKey = keyof typeof en
