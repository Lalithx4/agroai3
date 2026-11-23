'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowRight, Camera, Mic, Mountain, Cloud, CalendarDays, Pill, Phone, PhoneOff, PhoneIncoming, MessageCircle, Keyboard, School } from 'lucide-react';
import './landing.css';

// Landing copy lives here (not in i18n.js) because nothing else uses it.
const COPY = {
    en: {
        overline: 'A science fair project · TGMS Gundlamachanoor',
        title: 'A second opinion for your crop, in your language.',
        lede: 'Photograph a sick leaf. CropMagix names the likely problem, says how sure it is, and tells you what to do next.',
        start: 'Get started',
        tryScan: 'Try a scan',
        teamTitle: 'The people behind the notebook',
        teamIntro: 'A Class 9 science fair project from TGMS Gundlamachanoor.',
        guideLabel: 'Guiding teacher',
        guideRole: 'PGT Zoology',
        studentLabel: 'Student scientist',
        studentRole: 'Class 9 B',
        specimens: 'What it has learned to recognise',
        howTitle: 'How it works',
        steps: [
            ['Pick your crop', 'Tomato, potato, chilli and more. Knowing the crop makes the answer far more reliable.'],
            ['Photograph one leaf', 'In daylight, close up. Or show it and describe what you see, out loud.'],
            ['Read or hear the answer', 'The problem, how sure it is, and what to do today. In English, Hindi or Telugu.'],
        ],
        callTitle: 'Now the plant can phone you.',
        callBody: 'After a scan, leave your phone number — and the plant itself rings your phone, in Telugu, Hindi or English, to remind you what to do today.',
        callTry: 'Try it in Voice Doctor',
        callTag: 'New · Plant phone call',
        callSteps: [
            ['Scan a leaf', 'Point the camera at one leaf. CropMagix names the problem and how sure it is.'],
            ['Leave your number', 'On the report, type your mobile number and agree to one call.'],
            ['Your plant rings you', 'A minute later your phone rings. The caller is your own tomato plant.'],
            ['Talk it through', 'It explains what is wrong and what to do today — in Telugu, Hindi or English — and answers your questions.'],
        ],
        callScanResult: 'Early blight · 86% sure',
        callNumberLabel: 'Your mobile number',
        callNumberBtn: 'Call my phone',
        callAr: 'Answer it in AR',
        callAccept: 'Accept',
        callDecline: 'Decline',
        callerName: 'Tomato plant',
        calling: 'Calling the farmer…',
        onCall: 'On call · 0:12',
        callLines: [
            'Namaste, this is your tomato plant.',
            'My leaf spot is getting worse.',
            'Please spray before Friday.',
        ],
        toolsTitle: 'Also in the notebook',
        tools: [
            ['Voice doctor', 'The plant answers aloud, in your language'],
            ['Soil test', 'Nutrients, pH and crops that suit your soil'],
            ['Weather for farming', 'Whether today suits spraying or field work'],
            ['Crop calendar', 'What to sow and when'],
            ['Medicine guide', 'Treatments, with organic options'],
            ['Plant phone call', 'The plant rings your phone with the advice'],
        ],
        honestTitle: 'It tells you when it is not sure.',
        honest: 'CropMagix is a second opinion, not the final word. When a photo is unclear or the signs are mixed, it says "Not sure yet" and asks you to retake the photo or show the leaf to your agriculture officer.',
        foot: 'A science fair project by Pranavi, Class 9 B · TGMS Gundlamachanoor',
        credit: 'Leaf photos: PlantVillage dataset (Hughes & Salathé).',
    },
    hi: {
        overline: 'एक साइंस फेयर परियोजना · TGMS Gundlamachanoor',
        title: 'आपकी फसल के लिए दूसरी राय, आपकी भाषा में।',
        lede: 'बीमार पत्ती की फोटो लें। CropMagix संभावित समस्या बताता है, कितना पक्का है यह बताता है, और आगे क्या करना है।',
        start: 'शुरू करें',
        tryScan: 'स्कैन आज़माएँ',
        teamTitle: 'नोटबुक के पीछे के लोग',
        teamIntro: 'TGMS Gundlamachanoor से कक्षा 9 की साइंस फेयर परियोजना।',
        guideLabel: 'मार्गदर्शक शिक्षिका',
        guideRole: 'पीजीटी ज़ूलॉजी',
        studentLabel: 'विद्यार्थिनी',
        studentRole: 'कक्षा 9 B',
        specimens: 'यह किन्हें पहचानना सीख चुका है',
        howTitle: 'यह कैसे काम करता है',
        steps: [
            ['अपनी फसल चुनें', 'टमाटर, आलू, मिर्च और भी। फसल पता हो तो जवाब ज़्यादा भरोसेमंद होता है।'],
            ['एक पत्ती की फोटो लें', 'दिन की रोशनी में, पास से। या दिखाकर बोलें कि क्या दिख रहा है।'],
            ['जवाब पढ़ें या सुनें', 'समस्या, कितना पक्का है, और आज क्या करें। हिंदी, तेलुगु या अंग्रेज़ी में।'],
        ],
        callTitle: 'अब पौधा आपको फ़ोन कर सकता है।',
        callBody: 'स्कैन के बाद अपना नंबर छोड़ें — और पौधा खुद आपके फ़ोन पर बजेगा, तेलुगु, हिंदी या अंग्रेज़ी में, और आज क्या करना है याद दिलाएगा।',
        callTry: 'वॉइस डॉक्टर में आज़माएँ',
        callTag: 'नया · पौधे का फ़ोन',
        callSteps: [
            ['पत्ती स्कैन करें', 'कैमरा एक पत्ती पर रखें। CropMagix समस्या और भरोसा बताता है।'],
            ['अपना नंबर दें', 'रिपोर्ट पर अपना मोबाइल नंबर लिखें और एक कॉल के लिए हाँ कहें।'],
            ['पौधा आपको फ़ोन करेगा', 'एक मिनट में फ़ोन बजेगा। कॉल करने वाला आपका अपना टमाटर का पौधा है।'],
            ['बात कीजिए', 'वह बताएगा क्या गड़बड़ है और आज क्या करें — तेलुगु, हिंदी या अंग्रेज़ी में — और आपके सवालों के जवाब देगा।'],
        ],
        callScanResult: 'अगेती झुलसा · 86% पक्का',
        callNumberLabel: 'आपका मोबाइल नंबर',
        callNumberBtn: 'मेरे फ़ोन पर कॉल करें',
        callAr: 'AR में उठाएँ',
        callAccept: 'उठाएँ',
        callDecline: 'काटें',
        callerName: 'टमाटर का पौधा',
        calling: 'किसान को कॉल हो रही है…',
        onCall: 'बातचीत चालू · 0:12',
        callLines: [
            'नमस्ते, मैं आपका टमाटर का पौधा हूँ।',
            'मेरा लीफ स्पॉट बढ़ रहा है।',
            'कृपया शुक्रवार से पहले छिड़काव कर दें।',
        ],
        toolsTitle: 'नोटबुक में और भी',
        tools: [
            ['वॉइस डॉक्टर', 'पौधा आपकी भाषा में बोलकर जवाब देता है'],
            ['मिट्टी जाँच', 'पोषक तत्व, pH और उपयुक्त फसलें'],
            ['खेती के लिए मौसम', 'क्या आज छिड़काव या खेत का काम ठीक है'],
            ['फसल कैलेंडर', 'क्या और कब बोना है'],
            ['दवा गाइड', 'उपचार, जैविक विकल्पों के साथ'],
            ['पौधे का फ़ोन कॉल', 'पौधा आपके फ़ोन पर सलाह देता है'],
        ],
        honestTitle: 'पक्का न हो तो यह बता देता है।',
        honest: 'CropMagix दूसरी राय है, अंतिम फैसला नहीं। फोटो साफ़ न हो या लक्षण मिले-जुले हों, तो यह "अभी पक्का नहीं" कहता है और दोबारा फोटो लेने या कृषि अधिकारी को दिखाने को कहता है।',
        foot: 'प्रणवि (कक्षा 9 B) की साइंस फेयर परियोजना · TGMS Gundlamachanoor',
        credit: 'पत्ती की फोटो: PlantVillage dataset (Hughes & Salathé).',
    },
    te: {
        overline: 'ఒక సైన్స్ ఫెయిర్ ప్రాజెక్ట్ · TGMS Gundlamachanoor',
        title: 'మీ పంటకు రెండో అభిప్రాయం, మీ భాషలో.',
        lede: 'జబ్బు ఆకు ఫోటో తీయండి. CropMagix సమస్యను, ఎంత ఖచ్చితంగా ఉందో, తర్వాత ఏం చేయాలో చెబుతుంది.',
        start: 'మొదలుపెట్టండి',
        tryScan: 'స్కాన్ ప్రయత్నించండి',
        teamTitle: 'నోట్‌బుక్ వెనుక ఉన్న వ్యక్తులు',
        teamIntro: 'TGMS Gundlamachanoor నుంచి 9వ తరగతి సైన్స్ ఫెయిర్ ప్రాజెక్ట్.',
        guideLabel: 'మార్గదర్శక ఉపాధ్యాయిని',
        guideRole: 'పీజీటీ జువాలజీ',
        studentLabel: 'విద్యార్థిని',
        studentRole: '9వ తరగతి B',
        specimens: 'ఇది గుర్తించడం నేర్చుకున్నవి',
        howTitle: 'ఇది ఎలా పనిచేస్తుంది',
        steps: [
            ['మీ పంటను ఎంచుకోండి', 'టమాటా, బంగాళదుంప, మిర్చి ఇంకా. పంట తెలిస్తే జవాబు మరింత నమ్మదగినది.'],
            ['ఒక ఆకు ఫోటో తీయండి', 'పగటి వెలుగులో, దగ్గరగా. లేదా చూపించి, మీరు చూసింది చెప్పండి.'],
            ['జవాబు చదవండి లేదా వినండి', 'సమస్య, ఎంత ఖచ్చితం, ఈ రోజు ఏం చేయాలి. తెలుగు, హిందీ లేదా ఇంగ్లీష్‌లో.'],
        ],
        callTitle: 'ఇప్పుడు మొక్క మీకు ఫోన్ చేయగలదు.',
        callBody: 'స్కాన్ తర్వాత మీ ఫోన్ నంబర్ ఇవ్వండి — మొక్కే మీ ఫోన్ మోగుతుంది, తెలుగు, హిందీ లేదా ఇంగ్లీష్‌లో, ఈ రోజు ఏం చేయాలో గుర్తు చేస్తూ.',
        callTry: 'వాయిస్ డాక్టర్‌లో ప్రయత్నించండి',
        callTag: 'కొత్తది · మొక్క ఫోన్ కాల్',
        callSteps: [
            ['ఆకును స్కాన్ చేయండి', 'కెమెరాను ఒక ఆకు వైపు చూపండి. CropMagix సమస్యను, ఎంత ఖచ్చితమో చెబుతుంది.'],
            ['మీ నంబర్ ఇవ్వండి', 'రిపోర్ట్‌లో మీ మొబైల్ నంబర్ రాసి, ఒక కాల్‌కు అంగీకరించండి.'],
            ['మీ మొక్క మీకు ఫోన్ చేస్తుంది', 'ఒక నిమిషంలో మీ ఫోన్ మోగుతుంది. కాల్ చేసేది మీ సొంత టమాటా మొక్క.'],
            ['మాట్లాడండి', 'ఏం తప్పు, ఈ రోజు ఏం చేయాలో చెబుతుంది — తెలుగు, హిందీ లేదా ఇంగ్లీష్‌లో — మీ ప్రశ్నలకు జవాబిస్తుంది.'],
        ],
        callScanResult: 'ముందస్తు ఆకుమచ్చ · 86% ఖచ్చితం',
        callNumberLabel: 'మీ మొబైల్ నంబర్',
        callNumberBtn: 'నా ఫోన్‌కు కాల్ చేయండి',
        callAr: 'AR లో ఎత్తండి',
        callAccept: 'ఎత్తండి',
        callDecline: 'కట్ చేయండి',
        callerName: 'టమాటా మొక్క',
        calling: 'రైతుకు కాల్ వెళ్తోంది…',
        onCall: 'మాటలాడుతున్నాం · 0:12',
        callLines: [
            'నమస్తే, నేను మీ టమాటా మొక్కను.',
            'నా ఆకు మచ్చ పెరుగుతోంది.',
            'దయచేసి శుక్రవారం లోపు పిచికారీ చేయండి.',
        ],
        toolsTitle: 'నోట్‌బుక్‌లో ఇంకా',
        tools: [
            ['వాయిస్ డాక్టర్', 'మొక్క మీ భాషలో మాట్లాడి జవాబిస్తుంది'],
            ['నేల పరీక్ష', 'పోషకాలు, pH మరియు తగిన పంటలు'],
            ['వ్యవసాయ వాతావరణం', 'ఈ రోజు పిచికారీకి లేదా పొలం పనికి అనుకూలమా'],
            ['పంట క్యాలెండర్', 'ఏది ఎప్పుడు విత్తాలి'],
            ['మందుల గైడ్', 'చికిత్సలు, సేంద్రియ ఎంపికలతో'],
            ['మొక్క ఫోన్ కాల్', 'మొక్క మీ ఫోన్‌లో సలహా ఇస్తుంది'],
        ],
        honestTitle: 'ఖచ్చితంగా తెలియకపోతే అదే చెబుతుంది.',
        honest: 'CropMagix రెండో అభిప్రాయం మాత్రమే, చివరి మాట కాదు. ఫోటో స్పష్టంగా లేకపోతే, "ఇంకా ఖచ్చితంగా తెలియదు" అని చెప్పి, మళ్ళీ ఫోటో తీయమని లేదా వ్యవసాయ అధికారికి చూపించమని చెబుతుంది.',
        foot: 'ప్రణవి (9వ తరగతి B) సైన్స్ ఫెయిర్ ప్రాజెక్ట్ · TGMS Gundlamachanoor',
        credit: 'ఆకు ఫోటోలు: PlantVillage dataset (Hughes & Salathé).',
    },
};

const SPECIMENS = [
    { src: '/images/leaves/tomato-early-blight.jpg', crop: 'Tomato', name: 'Early blight' },
    { src: '/images/leaves/potato-late-blight.jpg', crop: 'Potato', name: 'Late blight' },
    { src: '/images/leaves/corn-common-rust.jpg', crop: 'Maize', name: 'Common rust' },
    { src: '/images/leaves/grape-black-rot.jpg', crop: 'Grape', name: 'Black rot' },
];

// Photos: drop real photos at these paths in frontend/public/images/team/.
// Until then a notebook-style monogram card shows instead.
const TEAM = [
    {
        key: 'guide',
        photo: '/images/team/guide-m-padmaja.jpg',
        labelKey: 'guideLabel',
        name: 'M. Padmaja',
        roleKey: 'guideRole',
        monogram: 'MP',
    },
    {
        key: 'student',
        photo: '/images/team/student-pranavi.jpg',
        labelKey: 'studentLabel',
        name: 'Pranavi',
        roleKey: 'studentRole',
        monogram: 'P',
    },
];

const STORY_ICONS = [Camera, Keyboard, PhoneIncoming, MessageCircle];

const TOOL_ICONS = [Mic, Mountain, Cloud, CalendarDays, Pill, Phone];

// The phone-call demo runs one 12-second CSS loop: rings, connects, the plant
// talks (mouth moves, three lines cycle), then the call resets.
const CALL_CYCLE = '12s';

export default function LandingPage() {
    const router = useRouter();
    const { language } = useLanguage();
    const c = COPY[language] || COPY.en;

    const start = (href) => {
        localStorage.setItem('cropmagix_seen_landing', 'true');
        router.push(href);
    };

    // Scrollytelling: whichever call step sits in the middle of the screen drives the phone.
    const [callStage, setCallStage] = useState(1);
    useEffect(() => {
        const steps = document.querySelectorAll('.lp-story-steps > li');
        if (!('IntersectionObserver' in window)) return undefined;
        const io = new IntersectionObserver((entries) => entries.forEach((e) => {
            if (e.isIntersecting) setCallStage(Number(e.target.dataset.step));
        }), { rootMargin: '-55% 0px -35% 0px' });
        steps.forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, [language]);

    // Sections rise in gently as they scroll into view (skipped for reduced motion).
    useEffect(() => {
        const els = document.querySelectorAll('.lp > section');
        if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return undefined;
        els.forEach((el, i) => { if (i > 0) el.classList.add('lp-reveal'); });
        const io = new IntersectionObserver((entries) => entries.forEach((e) => {
            if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
        }), { rootMargin: '0px 0px -10% 0px' });
        els.forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, []);

    const hideMissingPhoto = (e) => e.currentTarget.remove();

    return (
        <div className="lp">
            <section className="lp-hero">
                <div className="lp-hero-text">
                    <p className="lp-badge">
                        <span className="lp-badge-icon"><School size={16} aria-hidden="true" /></span>
                        <span className="lp-badge-kind">{c.overline.split(' · ')[0]}</span>
                        <span className="lp-badge-school">{c.overline.split(' · ')[1]}</span>
                    </p>
                    <h1 className="lp-title">
                        {c.title.split(/,\s*/)[0]},{' '}
                        <mark className="lp-mark">{c.title.split(/,\s*/).slice(1).join(', ')}</mark>
                    </h1>
                    <p className="lp-lede">{c.lede}</p>
                    <div className="lp-ctas">
                        <button type="button" className="nb-btn nb-btn-primary" onClick={() => start('/home')}>
                            {c.start} <ArrowRight size={18} aria-hidden="true" />
                        </button>
                        <button type="button" className="nb-btn nb-btn-secondary" onClick={() => start('/scanner')}>
                            <Camera size={18} aria-hidden="true" /> {c.tryScan}
                        </button>
                    </div>
                    <ul className="lp-langs" aria-label="Languages">
                        <li lang="en">English</li><li lang="hi">हिंदी</li><li lang="te">తెలుగు</li>
                        <li className="lp-langs-voice"><Mic size={14} aria-hidden="true" /> Voice</li>
                    </ul>
                </div>

                <figure className="lp-sheet" aria-label={c.specimens}>
                    <figcaption className="nb-overline">{c.specimens}</figcaption>
                    <ol className="lp-specimens">
                        {SPECIMENS.map((s, i) => (
                            <li key={s.src}>
                                <img src={s.src} alt={`${s.crop} leaf with ${s.name.toLowerCase()}`} width={256} height={256} />
                                <span className="lp-specimen-no nb-numeral">{String(i + 1).padStart(2, '0')}</span>
                                <span className="lp-specimen-name">{s.name}</span>
                                <span className="lp-specimen-crop">{s.crop}</span>
                            </li>
                        ))}
                    </ol>
                </figure>
            </section>

            {/* Section 2 — the science fair team, as photos pinned in the notebook */}
            <section className="lp-team" aria-labelledby="lp-team-title">
                <div className="lp-team-text">
                    <h2 id="lp-team-title">{c.teamTitle}</h2>
                    <p className="lp-team-intro">{c.teamIntro}</p>
                    <div className="lp-school">
                        <span className="lp-school-seal" aria-hidden="true"><School size={26} /></span>
                        <span className="lp-school-text">
                            <strong>TGMS Gundlamachanoor</strong>
                            <span>{c.overline.split(' · ')[0]} · {c.studentRole}</span>
                        </span>
                    </div>
                </div>
                <div className="lp-team-cards">
                    {TEAM.map((m) => (
                        <figure key={m.key} className={`lp-member is-${m.key}`}>
                            <span className="lp-member-tape" aria-hidden="true" />
                            <span className="lp-member-photo">
                                <span className="lp-member-fallback" aria-hidden="true">{m.monogram}</span>
                                <img src={m.photo} alt={m.name} loading="lazy" onError={hideMissingPhoto} />
                            </span>
                            <figcaption>
                                <span className="lp-member-label nb-overline">{c[m.labelKey]}</span>
                                <span className="lp-member-name">{m.name}</span>
                                <span className="lp-member-role">{c[m.roleKey]}</span>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </section>

            <section className="lp-how" aria-labelledby="lp-how-title">
                <h2 id="lp-how-title">{c.howTitle}</h2>
                <ol className="lp-steps">
                    {c.steps.map(([title, body], i) => (
                        <li key={title}>
                            <span className="lp-step-no nb-numeral">{i + 1}</span>
                            <h3>{title}</h3>
                            <p>{body}</p>
                        </li>
                    ))}
                </ol>
            </section>

            {/* The plant can phone you — scrollytelling: the phone stays pinned, each step changes its screen */}
            <section className="lp-call" data-stage={callStage} aria-labelledby="lp-call-title">
                <header className="lp-call-intro">
                    <p className="lp-call-tag"><Phone size={14} aria-hidden="true" /> {c.callTag}</p>
                    <h2 id="lp-call-title">{c.callTitle}</h2>
                    <p>{c.callBody}</p>
                </header>

                <div className="lp-story">
                    <ol className="lp-story-steps" style={{ '--progress': (callStage - 1) / 3 }}>
                        {c.callSteps.map(([title, body], i) => {
                            const Icon = STORY_ICONS[i];
                            return (
                            <li key={title} data-step={i + 1} className={callStage === i + 1 ? 'is-active' : callStage > i + 1 ? 'is-done' : ''}>
                                <span className="lp-story-no nb-numeral">{i + 1}</span>
                                <span className="lp-story-icon" aria-hidden="true"><Icon size={18} /></span>
                                <h3>{title}</h3>
                                <p>{body}</p>
                            </li>
                            );
                        })}
                    </ol>

                    <div className="lp-call-stage">
                        <span className="lp-story-glow" aria-hidden="true" />
                        <div className="lp-phone" role="img" aria-label={`${c.callerName} — ${c.callSteps[callStage - 1][0]}`}>
                            <span className="lp-phone-notch" aria-hidden="true" />
                            <div className="lp-phone-screen" aria-hidden="true">
                                {/* 1 · scanning a leaf */}
                                <div className="lp-scr lp-scr-scan">
                                    <span className="lp-scan-photo">
                                        <img src="/images/leaves/tomato-early-blight.jpg" alt="" />
                                        <span className="lp-scan-line" />
                                        <span className="lp-scan-box" />
                                    </span>
                                    <span className="lp-scan-result"><Camera size={14} /> {c.callScanResult}</span>
                                </div>

                                {/* 2 · leaving the number */}
                                <div className="lp-scr lp-scr-number">
                                    <span className="lp-mini-report">
                                        <img src="/images/leaves/tomato-early-blight.jpg" alt="" />
                                        <span><b>{c.callerName}</b><em>{c.callScanResult}</em></span>
                                    </span>
                                    <span className="lp-num-label">{c.callNumberLabel}</span>
                                    <span className="lp-num-field"><span className="lp-num-typed">+91 98480 •••••</span><i className="lp-num-caret" /></span>
                                    <span className="lp-num-btn"><Phone size={16} /> {c.callNumberBtn}</span>
                                </div>

                                {/* 3 + 4 · ringing, then on the call */}
                                <div className="lp-scr lp-scr-call">
                                    <p className="lp-phone-over">CropMagix</p>
                                    <span className="lp-call-avatar">
                                        <span className="lp-call-waves"><i /><i /><i /></span>
                                        <span className="lp-call-avatar-eye" />
                                        <span className="lp-call-avatar-eye" />
                                        <span className="lp-call-avatar-mouth" />
                                    </span>
                                    <strong className="lp-phone-name">{c.callerName}</strong>
                                    <span className="lp-call-field">Field 2 · CropMagix</span>
                                    <span className="lp-call-status">
                                        <span className="is-calling">{c.calling}</span>
                                        <span className="is-oncall">{c.onCall}</span>
                                    </span>
                                    <span className="lp-wave" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</span>
                                    <div className="lp-call-screen">
                                        {c.callLines.map((line, i) => (
                                            <span key={line} className={`lp-call-bubble lp-bubble-${i + 1}`}>{line}</span>
                                        ))}
                                    </div>
                                    <div className="lp-phone-actions">
                                        <span className="lp-phone-btn is-decline"><PhoneOff size={22} /></span>
                                        <span className="lp-phone-btn is-accept"><Phone size={22} /></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <span className="lp-story-dots" aria-hidden="true">
                            {[1, 2, 3, 4].map((n) => <i key={n} className={n === callStage ? 'on' : n < callStage ? 'done' : ''} />)}
                        </span>
                    </div>
                </div>

                <div className="lp-call-ctas">
                    <button type="button" className="nb-btn lp-call-btn" onClick={() => start('/scanner')}>
                        <Camera size={18} aria-hidden="true" /> {c.callAr}
                    </button>
                    <button type="button" className="nb-btn lp-call-btn-ghost" onClick={() => start('/voice-doctor')}>
                        {c.callTry} <ArrowRight size={18} aria-hidden="true" />
                    </button>
                </div>
            </section>

            <section className="lp-split">
                <div className="lp-honest">
                    <h2>{c.honestTitle}</h2>
                    <p>{c.honest}</p>
                </div>
                <div className="lp-tools">
                    <h2 className="nb-overline">{c.toolsTitle}</h2>
                    <ul>
                        {c.tools.map(([title, body], i) => {
                            const Icon = TOOL_ICONS[i];
                            return (
                                <li key={title}>
                                    <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                                    <span><strong>{title}</strong>{body}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </section>

            <section className="lp-final">
                <h2>{c.title}</h2>
                <button type="button" className="nb-btn nb-btn-primary" onClick={() => start('/home')}>
                    {c.start} <ArrowRight size={18} aria-hidden="true" />
                </button>
            </section>

            <footer className="lp-foot">
                <span>{c.foot}</span>
                <span>{c.credit}</span>
                <Link href="/home">CropMagix</Link>
            </footer>
        </div>
    );
}
