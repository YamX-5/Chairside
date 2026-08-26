import type { ClinicDay } from '../schema'

/**
 * DEMO content — hand-written 2026-07-21. Exists to prove the engine is
 * subject-agnostic: same schema, same loop, medical rather than dental topic.
 * Clinical logic follows Resuscitation Council anaphylaxis guidance (adult doses).
 */
export const medAnaphylaxis: ClinicDay = {
  schemaVersion: 1,
  id: 'med-anaphylaxis',
  isDemo: true,
  track: 'medical',
  subject: { en: 'Medical Emergencies', ar: 'الطوارئ الطبية' },
  title: { en: 'Anaphylaxis in the Chair', ar: 'التأق على كرسي العيادة' },
  citations: ['Resuscitation Council anaphylaxis algorithm (adult)', 'ABCDE assessment framework'],
  prep: {
    missionTitle: { en: 'Prep: the emergency drill', ar: 'التحضير: تدريب الطوارئ' },
    briefing: {
      en: 'Nobody books an anaphylaxis. Run the drill this morning so your hands know it before your brain does.',
      ar: 'لا أحد يحجز موعداً للتأق. تدرّب هذا الصباح لتعرف يداك ما تفعلانه قبل أن يفكر عقلك.',
    },
    chunks: [
      {
        id: 'c1',
        title: { en: 'Recognising it', ar: 'التعرّف عليه' },
        body: {
          en: 'Anaphylaxis is a sudden airway, breathing, or circulation problem, usually with skin changes, after exposure to a trigger. Skin signs alone are not anaphylaxis. Airway swelling, wheeze, or a dropping blood pressure are what make it anaphylaxis — and what make it kill.',
          ar: 'التأق هو اضطراب مفاجئ في المجرى الهوائي أو التنفس أو الدوران، غالباً مع تغيّرات جلدية، بعد التعرّض لمُحسِّس. العلامات الجلدية وحدها ليست تأقاً. تورّم المجرى الهوائي أو الأزيز أو هبوط الضغط هو ما يجعله تأقاً — وما يجعله قاتلاً.',
        },
        question: {
          id: 'c1q',
          prompt: { en: 'A patient develops an itchy rash only, with normal breathing and blood pressure. Is this anaphylaxis?', ar: 'مريض ظهر لديه طفح حاكّ فقط، مع تنفس وضغط طبيعيين. هل هذا تأق؟' },
          options: [
            { id: 'a', label: { en: 'No — skin signs alone are an allergic reaction, not anaphylaxis', ar: 'لا — العلامات الجلدية وحدها تفاعل تحسسي لا تأق' }, isCorrect: true },
            { id: 'b', label: { en: 'Yes — any allergic reaction counts', ar: 'نعم — أي تفاعل تحسسي يُحتسب' }, isCorrect: false },
            { id: 'c', label: { en: 'Yes, if the rash is spreading', ar: 'نعم، إذا كان الطفح ينتشر' }, isCorrect: false },
          ],
          explanation: {
            en: 'Anaphylaxis requires an A, B, or C problem. Watch closely and be ready — but adrenaline is for airway, breathing, or circulation compromise.',
            ar: 'يتطلب التأق اضطراباً في A أو B أو C. راقب عن قرب وكن مستعداً — لكن الأدرينالين مخصص لاختلال المجرى الهوائي أو التنفس أو الدوران.',
          },
          sourceRef: { en: 'Slide 6' },
        },
      },
      {
        id: 'c2',
        title: { en: 'The dose you must never forget', ar: 'الجرعة التي يجب ألا تنساها' },
        body: {
          en: 'Adult adrenaline for anaphylaxis: 0.5 mg of 1:1000 intramuscularly into the anterolateral thigh. That is 0.5 mL. Repeat after 5 minutes if there is no improvement. Intramuscular, not intravenous — IV adrenaline in untrained hands causes arrhythmias and deaths.',
          ar: 'جرعة الأدرينالين للبالغ في التأق: 0.5 ملغ بتركيز 1:1000 عضلياً في الوجه الأمامي الوحشي للفخذ، أي 0.5 مل. تُكرَّر بعد 5 دقائق إن لم يتحسن. عضلياً لا وريدياً — فالأدرينالين الوريدي بأيدٍ غير مدربة يسبب اضطرابات نظم ووفيات.',
        },
        question: {
          id: 'c2q',
          prompt: { en: 'Correct adult adrenaline dose and route?', ar: 'ما جرعة الأدرينالين الصحيحة للبالغ وطريق إعطائها؟' },
          options: [
            { id: 'a', label: { en: '0.5 mg of 1:1000 intramuscular, anterolateral thigh', ar: '0.5 mg of 1:1000 IM عضلياً في الوجه الأمامي الوحشي للفخذ' }, isCorrect: true },
            { id: 'b', label: { en: '1 mg of 1:10,000 intravenous', ar: '1 ملغ 1:10000 وريدياً' }, isCorrect: false },
            { id: 'c', label: { en: '0.5 mg of 1:1000 subcutaneous into the arm', ar: '0.5 mg of 1:1000 تحت الجلد في الذراع' }, isCorrect: false },
            { id: 'd', label: { en: '0.3 mg of 1:1000 intramuscular, deltoid', ar: '0.3 ملغ 1:1000 عضلياً في الدالية' }, isCorrect: false },
          ],
          explanation: {
            en: '1:10,000 IV is the cardiac arrest dose, not the anaphylaxis dose. The thigh is chosen because absorption there is fastest.',
            ar: 'تركيز 1:10000 وريدياً هو جرعة توقف القلب لا التأق. ويُختار الفخذ لأن الامتصاص فيه أسرع.',
          },
          sourceRef: { en: 'Slide 11' },
        },
      },
      {
        id: 'c3',
        title: { en: 'Position matters', ar: 'الوضعية مهمة' },
        body: {
          en: 'Lie the patient flat and raise the legs to support the circulation. If they are struggling to breathe, let them sit up. Never stand them up or walk them to another room — sudden upright posture in anaphylaxis has caused cardiac arrest within seconds.',
          ar: 'اضجع المريض ممدداً وارفع ساقيه لدعم الدوران. وإن كان يعاني في التنفس فدعه يجلس. لا تُوقفه أبداً ولا تنقله مشياً إلى غرفة أخرى — فالانتصاب المفاجئ في التأق سبّب توقف قلب خلال ثوانٍ.',
        },
        question: {
          id: 'c3q',
          prompt: { en: 'A hypotensive anaphylaxis patient asks to walk to the recovery room. What do you do?', ar: 'مريض تأق مع هبوط ضغط يطلب المشي إلى غرفة الإفاقة. ماذا تفعل؟' },
          options: [
            { id: 'a', label: { en: 'Keep them lying flat with legs raised', ar: 'أبقه مستلقياً مع رفع الساقين' }, isCorrect: true },
            { id: 'b', label: { en: 'Support them as they walk slowly', ar: 'اسنده وهو يمشي ببطء' }, isCorrect: false },
            { id: 'c', label: { en: 'Sit them upright in a wheelchair', ar: 'أجلسه منتصباً في كرسي متحرك' }, isCorrect: false },
          ],
          explanation: {
            en: 'Standing removes the venous return keeping their pressure up. Flat with legs raised, and the room comes to the patient.',
            ar: 'الوقوف يُفقده العود الوريدي الذي يحافظ على ضغطه. أبقه مستلقياً مع رفع الساقين، ولتأتِ الغرفة إلى المريض.',
          },
          sourceRef: { en: 'Slide 15' },
        },
      },
    ],
  },
  treat: {
    missionTitle: { en: 'Treat: 11:40 emergency', ar: 'العلاج: طارئ الساعة 11:40' },
    cases: [
      {
        id: 'p1',
        patient: { name: { en: 'Layla A.', ar: 'ليلى أ.' }, age: 29, avatar: '🧕' },
        chiefComplaint: {
          en: 'Routine restoration. Four minutes after amoxicillin prophylaxis she says her throat feels tight and she cannot get a full breath.',
          ar: 'ترميم روتيني. بعد أربع دقائق من الوقاية بالأموكسيسيلين تقول إن حلقها يضيق ولا تستطيع أخذ نفس كامل.',
        },
        history: { en: 'No known drug allergies documented. Otherwise healthy.', ar: 'لا حساسية دوائية موثّقة. بصحة جيدة عدا ذلك.' },
        findings: [
          { en: 'Audible wheeze, hoarse voice', ar: 'أزيز مسموع، بحّة في الصوت' },
          { en: 'Blood pressure 82/50, pulse 128', ar: 'الضغط 82/50، النبض 128' },
          { en: 'Spreading urticaria on the neck and chest', ar: 'شرى منتشر على العنق والصدر' },
          { en: 'Oxygen saturation 91% on room air', ar: 'إشباع الأكسجين 91% على هواء الغرفة' },
        ],
        decisions: [
          {
            id: 'd1',
            prompt: { en: 'First action?', ar: 'ما الإجراء الأول؟' },
            options: [
              {
                id: 'a',
                label: { en: 'Stop the trigger, call for help, give IM adrenaline', ar: 'أوقف المُحسِّس، اطلب المساعدة، أعطِ الأدرينالين عضلياً IM adrenaline' },
                quality: 'best',
                feedback: { en: 'Correct. Airway and circulation are both compromised — adrenaline now, not after you have finished assessing.', ar: 'صحيح. المجرى الهوائي والدوران مختلّان معاً — الأدرينالين الآن، لا بعد إتمام التقييم.' },
                sourceRef: { en: 'Slide 11' },
              },
              {
                id: 'b',
                label: { en: 'Give oral antihistamine and observe', ar: 'أعطِ مضاد هيستامين فموياً oral antihistamine وراقب' },
                quality: 'poor',
                feedback: { en: 'Antihistamines do nothing for airway swelling or shock, and oral absorption in a shocked patient is unreliable. This delay is what kills.', ar: 'مضادات الهيستامين لا تفعل شيئاً لتورّم المجرى الهوائي أو الصدمة، والامتصاص الفموي لدى مريض بصدمة غير موثوق. هذا التأخير هو القاتل.' },
              },
              {
                id: 'c',
                label: { en: 'Take a full allergy history before treating', ar: 'خذ قصة تحسسية كاملة قبل العلاج' },
                quality: 'poor',
                feedback: { en: 'The history can wait; her airway cannot. Treat first, document after.', ar: 'القصة يمكن أن تنتظر؛ مجراها الهوائي لا يستطيع. عالج أولاً ووثّق لاحقاً.' },
              },
              {
                id: 'd',
                label: { en: 'Give high-flow oxygen and reassess in 5 minutes', ar: 'أعطِ أكسجيناً بتدفق عالٍ وأعد التقييم بعد 5 دقائق' },
                quality: 'acceptable',
                feedback: { en: 'Oxygen is right and necessary — but it is not the first action. Adrenaline goes in first, oxygen alongside it.', ar: 'الأكسجين صحيح وضروري — لكنه ليس الإجراء الأول. الأدرينالين أولاً والأكسجين معه.' },
              },
            ],
          },
          {
            id: 'd2',
            prompt: { en: 'Draw up the adrenaline. Which is it?', ar: 'حضّر الأدرينالين. أيّها؟' },
            options: [
              { id: 'a', label: { en: '0.5 mL of 1:1000 IM', ar: '0.5 mL of 1:1000 IM عضلياً' }, quality: 'best', feedback: { en: 'Correct — 0.5 mg, anterolateral thigh, through clothing if needed.', ar: 'صحيح — 0.5 ملغ في الوجه الأمامي الوحشي للفخذ، عبر الملابس إن لزم.' } },
              { id: 'b', label: { en: '5 mL of 1:10,000 IV', ar: '5 mL of 1:10,000 IV وريدياً' }, quality: 'poor', feedback: { en: 'That is the cardiac arrest preparation. IV adrenaline here risks a fatal arrhythmia.', ar: 'هذا تحضير توقف القلب. الأدرينالين الوريدي هنا يهدد باضطراب نظم قاتل.' } },
              { id: 'c', label: { en: '0.5 mL of 1:1000 subcutaneously', ar: '0.5 مل 1:1000 تحت الجلد' }, quality: 'poor', feedback: { en: 'Right drug, wrong route — subcutaneous absorption is too slow in a shocked patient with shut-down peripheries.', ar: 'الدواء صحيح والطريق خاطئ — الامتصاص تحت الجلد بطيء جداً لدى مريض بصدمة وأطراف منغلقة.' } },
            ],
          },
          {
            id: 'd3',
            prompt: { en: 'How do you position her?', ar: 'كيف تضعها؟' },
            options: [
              { id: 'a', label: { en: 'Flat with legs raised, sitting up only if breathing worsens', ar: 'مستلقية مع رفع الساقين، وتجلس فقط إن ساء التنفس' }, quality: 'best', feedback: { en: 'Correct. Hypotension favours legs up; her airway symptoms mean you must be ready to let her sit.', ar: 'صحيح. هبوط الضغط يستدعي رفع الساقين؛ وأعراض مجراها الهوائي تعني استعدادك لإجلاسها.' } },
              { id: 'b', label: { en: 'Walk her to the recovery room to lie down', ar: 'امشِ بها إلى غرفة الإفاقة لتستلقي' }, quality: 'poor', feedback: { en: 'Never. Sudden upright posture in anaphylaxis has caused arrest within seconds.', ar: 'أبداً. الانتصاب المفاجئ في التأق سبّب توقف قلب خلال ثوانٍ.' } },
              { id: 'c', label: { en: 'Fully upright in the dental chair', ar: 'منتصبة تماماً على كرسي العيادة' }, quality: 'poor', feedback: { en: 'Upright drops her venous return further when she is already at 82/50.', ar: 'الانتصاب يخفض عودها الوريدي أكثر وضغطها أصلاً 82/50.' } },
            ],
          },
          {
            id: 'd4',
            prompt: { en: 'Five minutes on: still wheezing, BP 84/52. Next?', ar: 'بعد خمس دقائق: أزيز مستمر، الضغط 84/52. ماذا بعد؟' },
            options: [
              { id: 'a', label: { en: 'Repeat IM adrenaline 0.5 mg', ar: 'كرر الأدرينالين عضلياً — repeat IM adrenaline 0.5 mg' }, quality: 'best', feedback: { en: 'Correct. No improvement at 5 minutes means a repeat dose. Roughly a third of cases need more than one.', ar: 'صحيح. عدم التحسن بعد 5 دقائق يعني جرعة مكررة. نحو ثلث الحالات تحتاج أكثر من جرعة.' } },
              { id: 'b', label: { en: 'Wait another 10 minutes before repeating', ar: 'انتظر 10 دقائق أخرى قبل التكرار' }, quality: 'poor', feedback: { en: 'Too long. The repeat interval is 5 minutes when there has been no response.', ar: 'وقت طويل جداً. فاصل التكرار 5 دقائق عند غياب الاستجابة.' } },
              { id: 'c', label: { en: 'Give IV fluids only and hold further adrenaline', ar: 'أعطِ سوائل وريدية فقط وأوقف الأدرينالين' }, quality: 'acceptable', feedback: { en: 'Fluids are genuinely indicated for her hypotension — but they go alongside the repeat adrenaline, not instead of it.', ar: 'السوائل مستطبّة فعلاً لهبوط ضغطها — لكنها تُعطى مع الجرعة المكررة لا بدلاً منها.' } },
            ],
          },
        ],
        outcome: {
          success: {
            en: 'Layla stabilises before the ambulance arrives. Amoxicillin allergy is now on her file in red, and the crew take her in for observation — biphasic reactions are real.',
            ar: 'تستقر ليلى قبل وصول الإسعاف. حساسية الأموكسيسيلين مسجّلة الآن بالأحمر في ملفها، ويأخذها الطاقم للمراقبة — فالتفاعلات ثنائية الطور حقيقية.',
          },
          partial: {
            en: 'She made it, but minutes were lost that you will not get back in a real chair. Run the drill again.',
            ar: 'نجت، لكن ضاعت دقائق لن تستعيدها على كرسي حقيقي. أعد التدريب.',
          },
          failure: {
            en: 'The ambulance crew took over a patient who should have been stabilising by then. This is the case the inspector opens first on Audit Day.',
            ar: 'استلم طاقم الإسعاف مريضة كان يجب أن تكون مستقرة. هذه هي الحالة التي يفتحها المدقق أولاً في يوم التدقيق.',
          },
        },
      },
    ],
  },
}
