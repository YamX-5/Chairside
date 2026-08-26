import type { ClinicDay } from '../schema'

/**
 * DEMO content — hand-written 2026-07-21 to prove the loop (Phase 0).
 * Clinical logic follows the 2018 EFP/AAP classification of periodontal diseases
 * and the Löe-Silness gingival index. Replace with Yaman's own lecture material.
 */
export const perioStaging: ClinicDay = {
  schemaVersion: 1,
  id: 'perio-staging',
  isDemo: true,
  track: 'dental',
  subject: { en: 'Periodontology', ar: 'أمراض اللثة' },
  title: { en: 'Staging & Grading', ar: 'التصنيف والتدريج' },
  citations: ['2018 EFP/AAP classification of periodontal diseases', 'Löe & Silness gingival index (1963)'],
  prep: {
    missionTitle: { en: 'Prep: staging a perio case', ar: 'التحضير: تصنيف حالة لثوية' },
    briefing: {
      en: 'A perio referral is booked for 3pm. You have the morning to prep — learn it now, use it this afternoon.',
      ar: 'لديك إحالة لثوية الساعة 3 عصراً. أمامك الصباح للتحضير — تعلّمها الآن، واستخدمها بعد الظهر.',
    },
    chunks: [
      {
        id: 'c1',
        title: { en: 'What stage measures', ar: 'ماذا يقيس التصنيف' },
        body: {
          en: 'Stage describes the severity and complexity of damage already done. It is set by the worst site: interdental clinical attachment loss (CAL) at the site of greatest loss, backed up by radiographic bone loss and tooth loss from periodontitis. Stage never goes down — damage is history, and history does not heal.',
          ar: 'يصف التصنيف شدة وتعقيد الضرر الحاصل بالفعل. يُحدَّد بأسوأ موقع: فقدان الارتباط السريري بين الأسنان (CAL) في الموقع الأكثر تضرراً، مدعوماً بفقدان العظم الشعاعي وفقدان الأسنان بسبب التهاب دواعم السن. التصنيف لا ينخفض أبداً — فالضرر تاريخ، والتاريخ لا يُشفى.',
        },
        question: {
          id: 'c1q',
          prompt: {
            en: 'Which measurement primarily determines the stage?',
            ar: 'أي قياس يُحدِّد التصنيف بشكل أساسي؟',
          },
          options: [
            { id: 'a', label: { en: 'Interdental CAL at the site of greatest loss', ar: 'فقدان الارتباط السريري بين الأسنان في الموقع الأكثر تضرراً' }, isCorrect: true },
            { id: 'b', label: { en: 'Probing depth averaged across the mouth', ar: 'متوسط عمق السبر في الفم كاملاً' }, isCorrect: false },
            { id: 'c', label: { en: 'Bleeding on probing percentage', ar: 'نسبة النزف عند السبر' }, isCorrect: false },
            { id: 'd', label: { en: 'Plaque index', ar: 'مشعر اللويحة' }, isCorrect: false },
          ],
          explanation: {
            en: 'Stage is set by the worst interdental CAL — not by averages and not by inflammation markers, which change week to week.',
            ar: 'يُحدَّد التصنيف بأسوأ قيمة لفقدان الارتباط بين الأسنان — لا بالمتوسطات ولا بمؤشرات الالتهاب التي تتغير أسبوعياً.',
          },
          sourceRef: { en: 'Slide 12' },
        },
      },
      {
        id: 'c2',
        title: { en: 'The four stages', ar: 'المراحل الأربع' },
        body: {
          en: 'Stage I: CAL 1–2 mm. Stage II: CAL 3–4 mm. Stage III: CAL ≥5 mm, bone loss extending to the mid-third of the root or beyond, up to 4 teeth lost. Stage IV: same attachment loss but with masticatory dysfunction — 5 or more teeth lost, bite collapse, drifting, less than 20 remaining teeth. The jump from III to IV is about function, not millimetres.',
          ar: 'المرحلة الأولى: CAL 1–2 ملم. الثانية: 3–4 ملم. الثالثة: CAL ≥5 ملم مع امتداد فقدان العظم إلى الثلث الأوسط للجذر أو أبعد، وفقدان حتى 4 أسنان. الرابعة: نفس فقدان الارتباط لكن مع خلل وظيفي في المضغ — فقدان 5 أسنان أو أكثر، انهيار الإطباق، هجرة الأسنان، أقل من 20 سناً متبقياً. الانتقال من الثالثة إلى الرابعة يتعلق بالوظيفة لا بالمليمترات.',
        },
        question: {
          id: 'c2q',
          prompt: {
            en: 'A patient has CAL of 6 mm and has lost 6 teeth to periodontitis, with a collapsed bite. Stage?',
            ar: 'مريض لديه CAL بمقدار 6 ملم وفقد 6 أسنان بسبب التهاب دواعم السن مع انهيار في الإطباق. ما المرحلة؟',
          },
          options: [
            { id: 'a', label: { en: 'Stage II', ar: 'المرحلة الثانية — Stage II' }, isCorrect: false },
            { id: 'b', label: { en: 'Stage III', ar: 'المرحلة الثالثة — Stage III' }, isCorrect: false },
            { id: 'c', label: { en: 'Stage IV', ar: 'المرحلة الرابعة — Stage IV' }, isCorrect: true },
            { id: 'd', label: { en: 'Cannot be staged without radiographs', ar: 'لا يمكن التصنيف دون صور شعاعية' }, isCorrect: false },
          ],
          explanation: {
            en: '≥5 teeth lost plus masticatory dysfunction pushes the case to Stage IV even though the CAL alone would read as Stage III.',
            ar: 'فقدان 5 أسنان أو أكثر مع خلل وظيفي في المضغ يرفع الحالة إلى المرحلة الرابعة رغم أن قيمة CAL وحدها تقرأ كمرحلة ثالثة.',
          },
          sourceRef: { en: 'Slide 18' },
        },
      },
      {
        id: 'c3',
        title: { en: 'Grade = speed', ar: 'التدريج = السرعة' },
        body: {
          en: 'Grade estimates how fast the disease is moving and how it will answer treatment. Direct evidence is bone loss over time; indirect evidence is the ratio of radiographic bone loss percentage to age. Below 0.25 is Grade A, 0.25–1.0 is Grade B, above 1.0 is Grade C. Smoking and poorly controlled diabetes are grade modifiers that shift the case upward regardless of the ratio.',
          ar: 'يُقدِّر التدريج سرعة تقدّم المرض وكيفية استجابته للعلاج. الدليل المباشر هو فقدان العظم عبر الزمن؛ والدليل غير المباشر هو نسبة فقدان العظم الشعاعي إلى العمر. أقل من 0.25 درجة A، ومن 0.25 إلى 1.0 درجة B، وأكثر من 1.0 درجة C. التدخين والسكري غير المضبوط عاملان معدِّلان يرفعان الدرجة بغض النظر عن النسبة.',
        },
        question: {
          id: 'c3q',
          prompt: {
            en: 'A 40-year-old has 20% radiographic bone loss. What is the bone loss / age ratio and grade?',
            ar: 'مريض عمره 40 عاماً لديه فقدان عظم شعاعي 20%. ما نسبة فقدان العظم إلى العمر وما الدرجة؟',
          },
          options: [
            { id: 'a', label: { en: '0.5 — Grade B', ar: '0.5 — الدرجة B' }, isCorrect: true },
            { id: 'b', label: { en: '0.5 — Grade A', ar: '0.5 — الدرجة A' }, isCorrect: false },
            { id: 'c', label: { en: '2.0 — Grade C', ar: '2.0 — الدرجة C' }, isCorrect: false },
            { id: 'd', label: { en: '0.2 — Grade A', ar: '0.2 — الدرجة A' }, isCorrect: false },
          ],
          explanation: {
            en: '20 ÷ 40 = 0.5, which lands in the 0.25–1.0 band: Grade B. A smoking history would then push it toward Grade C.',
            ar: '20 ÷ 40 = 0.5، وتقع ضمن النطاق 0.25–1.0 أي الدرجة B. ووجود تدخين يدفعها نحو الدرجة C.',
          },
          sourceRef: { en: 'Slide 24' },
        },
      },
    ],
  },
  treat: {
    missionTitle: { en: 'Treat: the 3pm referral', ar: 'العلاج: إحالة الساعة 3' },
    cases: [
      {
        id: 'p1',
        patient: { name: { en: 'Rami H.', ar: 'رامي ح.' }, age: 38, avatar: '🧔' },
        chiefComplaint: {
          en: '"My gums bleed every time I brush, and my front teeth have started to spread apart."',
          ar: '«لثتي تنزف كلما نظّفت أسناني، وأسناني الأمامية بدأت تتباعد.»',
        },
        history: {
          en: 'Smokes 15 cigarettes a day for 18 years. No diabetes. Last cleaning was 4 years ago.',
          ar: 'يدخّن 15 سيجارة يومياً منذ 18 عاماً. لا يوجد سكري. آخر تنظيف كان قبل 4 سنوات.',
        },
        findings: [
          { en: 'Interdental CAL 6 mm at the worst site (upper right first molar)', ar: 'فقدان ارتباط سريري بين الأسنان 6 ملم في أسوأ موقع (الرحى الأولى العلوية اليمنى)' },
          { en: 'Radiographic bone loss ~45%, extending to the mid-third of the roots', ar: 'فقدان عظم شعاعي ~45% يمتد إلى الثلث الأوسط للجذور' },
          { en: 'No teeth lost to periodontitis; 28 teeth present', ar: 'لا فقدان أسنان بسبب التهاب دواعم السن؛ 28 سناً موجودة' },
          { en: 'Bleeding on probing 62%; generalised', ar: 'نزف عند السبر 62%؛ معمّم' },
        ],
        decisions: [
          {
            id: 'd1',
            prompt: { en: 'Stage this case.', ar: 'صنّف هذه الحالة.' },
            options: [
              {
                id: 'a',
                label: { en: 'Stage II', ar: 'المرحلة الثانية — Stage II' },
                quality: 'poor',
                feedback: {
                  en: 'Stage II tops out at 4 mm CAL. This patient is at 6 mm with bone loss into the mid-third of the root.',
                  ar: 'المرحلة الثانية تصل حتى 4 ملم فقط. هذا المريض عند 6 ملم مع فقدان عظم يصل إلى الثلث الأوسط للجذر.',
                },
                sourceRef: { en: 'Slide 18' },
              },
              {
                id: 'b',
                label: { en: 'Stage III', ar: 'المرحلة الثالثة — Stage III' },
                quality: 'best',
                feedback: {
                  en: 'Correct. CAL ≥5 mm with bone loss to the mid-third and no tooth loss from periodontitis — textbook Stage III.',
                  ar: 'صحيح. CAL ≥5 ملم مع فقدان عظم حتى الثلث الأوسط ودون فقدان أسنان بسبب المرض — مرحلة ثالثة نموذجية.',
                },
                sourceRef: { en: 'Slide 18' },
              },
              {
                id: 'c',
                label: { en: 'Stage IV', ar: 'المرحلة الرابعة — Stage IV' },
                quality: 'poor',
                feedback: {
                  en: 'Stage IV needs masticatory dysfunction — 5+ teeth lost, bite collapse, drifting. He has all 28 teeth and a stable bite.',
                  ar: 'المرحلة الرابعة تتطلب خللاً وظيفياً في المضغ — فقدان 5 أسنان أو أكثر أو انهيار الإطباق. لديه 28 سناً وإطباق مستقر.',
                },
                sourceRef: { en: 'Slide 18' },
              },
            ],
          },
          {
            id: 'd2',
            prompt: { en: 'Grade it. He is 38 with ~45% bone loss and smokes 15/day.', ar: 'حدّد الدرجة. عمره 38 ولديه فقدان عظم ~45% ويدخّن 15 سيجارة يومياً.' },
            options: [
              {
                id: 'a',
                label: { en: 'Grade A', ar: 'الدرجة A — Grade A' },
                quality: 'poor',
                feedback: {
                  en: 'Grade A means slow progression, ratio under 0.25. His ratio is 45 ÷ 38 ≈ 1.18.',
                  ar: 'الدرجة A تعني تقدماً بطيئاً بنسبة أقل من 0.25. نسبته 45 ÷ 38 ≈ 1.18.',
                },
              },
              {
                id: 'b',
                label: { en: 'Grade B', ar: 'الدرجة B — Grade B' },
                quality: 'acceptable',
                feedback: {
                  en: 'Close, but the ratio is 1.18 — above the 1.0 cut-off — and 15 cigarettes a day is itself a Grade C modifier.',
                  ar: 'قريب، لكن النسبة 1.18 أي فوق الحد 1.0، كما أن 15 سيجارة يومياً بحد ذاتها عامل يرفع إلى الدرجة C.',
                },
              },
              {
                id: 'c',
                label: { en: 'Grade C', ar: 'الدرجة C — Grade C' },
                quality: 'best',
                feedback: {
                  en: 'Correct. 45 ÷ 38 ≈ 1.18 (>1.0), and heavy smoking is a grade modifier pushing to C. Expect rapid progression.',
                  ar: 'صحيح. 45 ÷ 38 ≈ 1.18 (أكبر من 1.0)، والتدخين الكثيف عامل معدِّل يرفع إلى C. توقّع تقدماً سريعاً.',
                },
              },
            ],
          },
          {
            id: 'd3',
            prompt: { en: 'What is the extent descriptor?', ar: 'ما واصف الامتداد؟' },
            options: [
              {
                id: 'a',
                label: { en: 'Localised (<30% of sites)', ar: 'موضّع Localised (أقل من 30% من المواقع)' },
                quality: 'poor',
                feedback: { en: 'Bleeding and attachment loss are described as generalised across the mouth.', ar: 'النزف وفقدان الارتباط موصوفان كمعمّمين في الفم كاملاً.' },
              },
              {
                id: 'b',
                label: { en: 'Generalised (≥30% of sites)', ar: 'معمّم Generalised (30% أو أكثر من المواقع)' },
                quality: 'best',
                feedback: { en: 'Correct — the full diagnosis reads: generalised periodontitis, Stage III, Grade C.', ar: 'صحيح — التشخيص الكامل: التهاب دواعم سن معمّم، المرحلة الثالثة، الدرجة C.' },
              },
              {
                id: 'c',
                label: { en: 'Molar-incisor pattern', ar: 'نمط الرحى-القاطعة Molar-incisor pattern' },
                quality: 'poor',
                feedback: { en: 'That descriptor is reserved for disease confined to first molars and incisors. His involvement is widespread.', ar: 'هذا الواصف مخصص للمرض المحصور في الرحى الأولى والقواطع. إصابته واسعة الانتشار.' },
              },
            ],
          },
          {
            id: 'd4',
            prompt: { en: 'First step of therapy?', ar: 'ما الخطوة العلاجية الأولى؟' },
            options: [
              {
                id: 'a',
                label: { en: 'Refer straight to periodontal surgery', ar: 'إحالة مباشرة إلى جراحة اللثة' },
                quality: 'poor',
                feedback: {
                  en: 'Surgery before cause-related therapy operates on an infected, plaque-loaded field. Step 1 always comes first.',
                  ar: 'الجراحة قبل العلاج السببي تعني العمل على حقل ملتهب ومليء باللويحة. المرحلة الأولى تأتي دائماً أولاً.',
                },
              },
              {
                id: 'b',
                label: { en: 'Step 1: behaviour change — oral hygiene instruction, risk factor control, smoking cessation support', ar: 'المرحلة الأولى: تعديل السلوك — تعليم العناية الفموية، ضبط عوامل الخطر، دعم الإقلاع عن التدخين' },
                quality: 'best',
                feedback: {
                  en: 'Correct. Step 1 builds the foundation; in a Grade C smoker, cessation support is not optional — it is the treatment.',
                  ar: 'صحيح. المرحلة الأولى تبني الأساس؛ ولدى مدخّن بالدرجة C فإن دعم الإقلاع ليس خياراً — بل هو العلاج نفسه.',
                },
              },
              {
                id: 'c',
                label: { en: 'Systemic antibiotics alone', ar: 'صادات حيوية جهازية وحدها' },
                quality: 'poor',
                feedback: {
                  en: 'Antibiotics without mechanical biofilm disruption do not work — the biofilm protects itself, and you have bred resistance for nothing.',
                  ar: 'الصادات دون تفكيك ميكانيكي للغشاء الحيوي لا تنفع — فالغشاء يحمي نفسه، وتكون قد ولّدت مقاومة دون فائدة.',
                },
              },
              {
                id: 'd',
                label: { en: 'Scaling and root planing now, hygiene instruction after', ar: 'التقليح وتسوية الجذور scaling and root planing الآن، وتعليم العناية لاحقاً' },
                quality: 'acceptable',
                feedback: {
                  en: 'The instrumentation is right but the order is backwards — Step 2 without Step 1 relapses, because the patient goes home to the same habits.',
                  ar: 'الأداة صحيحة لكن الترتيب معكوس — المرحلة الثانية دون الأولى تنتكس، لأن المريض يعود إلى العادات نفسها.',
                },
              },
            ],
          },
        ],
        outcome: {
          success: {
            en: 'Rami leaves with a clear diagnosis — generalised periodontitis, Stage III, Grade C — a hygiene plan, and a smoking cessation referral. He books his Step 2 appointment on the way out.',
            ar: 'يغادر رامي بتشخيص واضح — التهاب دواعم سن معمّم، المرحلة الثالثة، الدرجة C — مع خطة عناية وإحالة للإقلاع عن التدخين. ويحجز موعد المرحلة الثانية قبل خروجه.',
          },
          partial: {
            en: 'You got Rami treated, but the staging notes will confuse whoever sees him next. Re-read the grading slides before Audit Day.',
            ar: 'عالجت رامي، لكن ملاحظات التصنيف ستربك من يراه لاحقاً. راجع شرائح التدريج قبل يوم التدقيق.',
          },
          failure: {
            en: 'Rami left with the wrong diagnosis on file. He will be back — and the inspector will have questions on Audit Day.',
            ar: 'غادر رامي وفي ملفه تشخيص خاطئ. سيعود — وسيكون لدى المدقق أسئلة في يوم التدقيق.',
          },
        },
      },
    ],
  },
}
