'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowRight, Camera, Mic, Mountain, Cloud, CalendarDays, Pill } from 'lucide-react';
import './landing.css';

// Landing copy lives here (not in i18n.js) because nothing else uses it.
const COPY = {
    en: {
        overline: 'For farmers · English, हिन्दी, తెలుగు',
        title: 'A second opinion for your crop, in your language.',
        lede: 'Photograph a sick leaf. CropMagix names the likely problem, says how sure it is, and tells you what to do next.',
        start: 'Get started',
        tryScan: 'Try a scan',
        specimens: 'What it has learned to recognise',
        howTitle: 'How it works',
        steps: [
            ['Pick your crop', 'Tomato, potato, chilli and more. Knowing the crop makes the answer far more reliable.'],
            ['Photograph one leaf', 'In daylight, close up. Or show it and describe what you see, out loud.'],
            ['Read or hear the answer', 'The problem, how sure it is, and what to do today. In English, Hindi or Telugu.'],
        ],
        toolsTitle: 'Also in the notebook',
        tools: [
            ['Voice doctor', 'The plant answers aloud, in your language'],
            ['Soil test', 'Nutrients, pH and crops that suit your soil'],
            ['Weather for farming', 'Whether today suits spraying or field work'],
            ['Crop calendar', 'What to sow and when'],
            ['Medicine guide', 'Treatments, with organic options'],
        ],
        honestTitle: 'It tells you when it is not sure.',
        honest: 'CropMagix is a second opinion, not the final word. When a photo is unclear or the signs are mixed, it says "Not sure yet" and asks you to retake the photo or show the leaf to your agriculture officer.',
        foot: 'Made in India, for farmers. A student project.',
        credit: 'Leaf photos: PlantVillage dataset (Hughes & Salathé).',
    },
    hi: {
        overline: 'किसानों के लिए · English, हिन्दी, తెలుగు',
        title: 'आपकी फसल के लिए दूसरी राय, आपकी भाषा में।',
        lede: 'बीमार पत्ती की फोटो लें। CropMagix संभावित समस्या बताता है, कितना पक्का है यह बताता है, और आगे क्या करना है।',
        start: 'शुरू करें',
        tryScan: 'स्कैन आज़माएँ',
        specimens: 'यह किन्हें पहचानना सीख चुका है',
        howTitle: 'यह कैसे काम करता है',
        steps: [
            ['अपनी फसल चुनें', 'टमाटर, आलू, मिर्च और भी। फसल पता हो तो जवाब ज़्यादा भरोसेमंद होता है।'],
            ['एक पत्ती की फोटो लें', 'दिन की रोशनी में, पास से। या दिखाकर बोलें कि क्या दिख रहा है।'],
            ['जवाब पढ़ें या सुनें', 'समस्या, कितना पक्का है, और आज क्या करें। हिंदी, तेलुगु या अंग्रेज़ी में।'],
        ],
        toolsTitle: 'नोटबुक में और भी',
        tools: [
            ['वॉइस डॉक्टर', 'पौधा आपकी भाषा में बोलकर जवाब देता है'],
            ['मिट्टी जाँच', 'पोषक तत्व, pH और उपयुक्त फसलें'],
            ['खेती के लिए मौसम', 'क्या आज छिड़काव या खेत का काम ठीक है'],
            ['फसल कैलेंडर', 'क्या और कब बोना है'],
            ['दवा गाइड', 'उपचार, जैविक विकल्पों के साथ'],
        ],
        honestTitle: 'पक्का न हो तो यह बता देता है।',
        honest: 'CropMagix दूसरी राय है, अंतिम फैसला नहीं। फोटो साफ़ न हो या लक्षण मिले-जुले हों, तो यह "अभी पक्का नहीं" कहता है और दोबारा फोटो लेने या कृषि अधिकारी को दिखाने को कहता है।',
        foot: 'भारत में, किसानों के लिए बनाया गया। एक छात्र परियोजना।',
        credit: 'पत्ती की फोटो: PlantVillage dataset (Hughes & Salathé).',
    },
    te: {
        overline: 'రైతుల కోసం · English, हिन्दी, తెలుగు',
        title: 'మీ పంటకు రెండో అభిప్రాయం, మీ భాషలో.',
        lede: 'జబ్బు ఆకు ఫోటో తీయండి. CropMagix సమస్యను, ఎంత ఖచ్చితంగా ఉందో, తర్వాత ఏం చేయాలో చెబుతుంది.',
        start: 'మొదలుపెట్టండి',
        tryScan: 'స్కాన్ ప్రయత్నించండి',
        specimens: 'ఇది గుర్తించడం నేర్చుకున్నవి',
        howTitle: 'ఇది ఎలా పనిచేస్తుంది',
        steps: [
            ['మీ పంటను ఎంచుకోండి', 'టమాటా, బంగాళదుంప, మిర్చి ఇంకా. పంట తెలిస్తే జవాబు మరింత నమ్మదగినది.'],
            ['ఒక ఆకు ఫోటో తీయండి', 'పగటి వెలుగులో, దగ్గరగా. లేదా చూపించి, మీరు చూసింది చెప్పండి.'],
            ['జవాబు చదవండి లేదా వినండి', 'సమస్య, ఎంత ఖచ్చితం, ఈ రోజు ఏం చేయాలి. తెలుగు, హిందీ లేదా ఇంగ్లీష్‌లో.'],
        ],
        toolsTitle: 'నోట్‌బుక్‌లో ఇంకా',
        tools: [
            ['వాయిస్ డాక్టర్', 'మొక్క మీ భాషలో మాట్లాడి జవాబిస్తుంది'],
            ['నేల పరీక్ష', 'పోషకాలు, pH మరియు తగిన పంటలు'],
            ['వ్యవసాయ వాతావరణం', 'ఈ రోజు పిచికారీకి లేదా పొలం పనికి అనుకూలమా'],
            ['పంట క్యాలెండర్', 'ఏది ఎప్పుడు విత్తాలి'],
            ['మందుల గైడ్', 'చికిత్సలు, సేంద్రియ ఎంపికలతో'],
        ],
        honestTitle: 'ఖచ్చితంగా తెలియకపోతే అదే చెబుతుంది.',
        honest: 'CropMagix రెండో అభిప్రాయం మాత్రమే, చివరి మాట కాదు. ఫోటో స్పష్టంగా లేకపోతే, "ఇంకా ఖచ్చితంగా తెలియదు" అని చెప్పి, మళ్ళీ ఫోటో తీయమని లేదా వ్యవసాయ అధికారికి చూపించమని చెబుతుంది.',
        foot: 'భారతదేశంలో, రైతుల కోసం తయారైంది. ఒక విద్యార్థి ప్రాజెక్ట్.',
        credit: 'ఆకు ఫోటోలు: PlantVillage dataset (Hughes & Salathé).',
    },
};

const SPECIMENS = [
    { src: '/images/leaves/tomato-early-blight.jpg', crop: 'Tomato', name: 'Early blight' },
    { src: '/images/leaves/potato-late-blight.jpg', crop: 'Potato', name: 'Late blight' },
    { src: '/images/leaves/corn-common-rust.jpg', crop: 'Maize', name: 'Common rust' },
    { src: '/images/leaves/grape-black-rot.jpg', crop: 'Grape', name: 'Black rot' },
];

const TOOL_ICONS = [Mic, Mountain, Cloud, CalendarDays, Pill];

export default function LandingPage() {
    const router = useRouter();
    const { language } = useLanguage();
    const c = COPY[language] || COPY.en;

    const start = (href) => {
        localStorage.setItem('cropmagix_seen_landing', 'true');
        router.push(href);
    };

    return (
        <div className="lp">
            <section className="lp-hero">
                <div className="lp-hero-text">
                    <p className="nb-overline">{c.overline}</p>
                    <h1 className="lp-title">{c.title}</h1>
                    <p className="lp-lede">{c.lede}</p>
                    <div className="lp-ctas">
                        <button type="button" className="nb-btn nb-btn-primary" onClick={() => start('/home')}>
                            {c.start} <ArrowRight size={18} aria-hidden="true" />
                        </button>
                        <button type="button" className="nb-btn nb-btn-secondary" onClick={() => start('/scanner')}>
                            <Camera size={18} aria-hidden="true" /> {c.tryScan}
                        </button>
                    </div>
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
