'use client';

import { useState } from 'react';
import {
    CheckCircle2, AlertTriangle, HelpCircle, CircleAlert, Sprout, ChevronDown, Check,
    HelpCircle as WhyIcon, PhoneIncoming, PhoneCall, Activity, Leaf, FlaskConical, Droplets, Sun, Thermometer, Lightbulb, Mic, RotateCcw, ShieldCheck,
} from 'lucide-react';
import { scheduleCall } from '@/lib/plant-call';
import './report.css';

/**
 * The plant report (EXPERIENCE.md · Scan result), laid out like a printed advisory:
 * verdict first, then a "do today" checklist, the diagnosis in brief, and everything else in
 * expandable sections (closed on phones, open on desktop).
 */

// Below 70% the accuracy ladder found answers unreliable, so we say so plainly.
const UNSURE_BELOW = 70;
// The plant's name: in our naming test, wrong names still came back at up to 72%, so offer the look-alikes below 75
// (the same line the live view uses before it settles on a name).
const NAME_UNSURE_BELOW = 75;

const COPY = {
    en: {
        nameUnsure: 'Not sure about the name. Is it one of these?', noPlant: 'No plant found. If there is one, type its name.', pickName: 'Pick the right plant or type its name.',
        wrongName: 'Wrong plant name?', typeName: 'Type the plant name', useName: 'Check again', nameSure: (n) => `name ${n}% sure`,
        unsure: 'Not sure yet', healthy: 'Looks healthy', serious: 'Serious problem', care: 'Needs care',
        unsureSub: (p) => `${p ? `It may be ${p}. ` : ''}Take another photo in daylight, closer to the leaf, or show it to your agriculture officer.`,
        healthySub: 'Keep checking the plant every few days.',
        seriousSub: (p) => `${p ? `Likely ${p}. ` : ''}Show this to your agriculture officer soon.`,
        careSub: (p) => (p ? `Likely ${p}. What to do is below.` : 'What to do is below.'),
        sure: (n) => `About ${n}% sure`,
        stage: 'Growth stage', today: 'What to do today', todayHint: 'Tick each step as you finish it.',
        diagnosis: 'Diagnosis', problem: 'Problem', type: 'Type', severity: 'Severity', urgency: 'Urgency', outlook: 'Outlook', affected: 'Affected',
        why: 'Why it happened', prevention: 'Prevention', likely: 'likelihood',
        plan: 'Treatment plan', daily: 'Every day', weekly: 'Every week', longTerm: 'Next season',
        organic: 'Organic options', ingredients: 'You need', preparation: 'Make it', apply: 'Apply',
        fertiliser: 'Fertiliser', purpose: 'Why', dose: 'How much', often: 'How often', organicAlt: 'Organic option',
        watering: 'Watering', frequency: 'How often', bestTime: 'Best time',
        conditions: 'Growing conditions', temp: 'Temperature', humidity: 'Humidity', sunlight: 'Sunlight', ph: 'Soil pH',
        tips: 'Good habits', officer: 'This is a second opinion. Check doses with your agriculture officer or agri shop before spraying.',
        saved: 'Saved to your history', again: 'Scan again', talk: 'Talk to this plant', callMe: 'Call me in 30 s', phoneCall: 'Call my phone', phoneTitle: 'Your plant will call your phone', phoneName: 'Your name', phoneNum: 'Mobile number', phoneConsent: 'I agree to receive calls from my plant (CropMagix). I can say stop any time.', phoneGo: 'Call me now', phoneCancel: 'Cancel', phoneRinging: 'Calling your phone now. It will start in Telugu.', phoneErr: 'Could not place the call', phoneNotSetup: 'Phone calling is not set up yet.', callSet: 'Your plant will call you in 30 seconds. Keep the app open.',
    },
    hi: {
        nameUnsure: 'नाम पक्का नहीं। क्या यह इनमें से कोई है?', noPlant: 'फोटो में पौधा नहीं मिला। अगर है, तो उसका नाम लिखें।', pickName: 'सही पौधा चुनें या उसका नाम लिखें।',
        wrongName: 'पौधे का नाम गलत है?', typeName: 'पौधे का नाम लिखें', useName: 'फिर से जाँचें', nameSure: (n) => `नाम ${n}% पक्का`,
        unsure: 'अभी पक्का नहीं', healthy: 'स्वस्थ लग रहा है', serious: 'गंभीर समस्या', care: 'देखभाल चाहिए',
        unsureSub: (p) => `${p ? `शायद ${p} हो। ` : ''}दिन की रोशनी में पत्ते के पास से एक और फोटो लें, या कृषि अधिकारी को दिखाएँ।`,
        healthySub: 'हर कुछ दिन में पौधे को देखते रहें।',
        seriousSub: (p) => `${p ? `शायद ${p}। ` : ''}जल्दी कृषि अधिकारी को दिखाएँ।`,
        careSub: (p) => (p ? `शायद ${p}। क्या करना है, नीचे लिखा है।` : 'क्या करना है, नीचे लिखा है।'),
        sure: (n) => `लगभग ${n}% पक्का`,
        stage: 'बढ़त की अवस्था', today: 'आज क्या करें', todayHint: 'हर काम पूरा होने पर निशान लगाएँ।',
        diagnosis: 'निदान', problem: 'समस्या', type: 'प्रकार', severity: 'गंभीरता', urgency: 'जल्दी', outlook: 'आगे क्या', affected: 'असर',
        why: 'ऐसा क्यों हुआ', prevention: 'बचाव', likely: 'संभावना',
        plan: 'इलाज की योजना', daily: 'हर दिन', weekly: 'हर हफ़्ते', longTerm: 'अगले मौसम',
        organic: 'जैविक उपाय', ingredients: 'क्या चाहिए', preparation: 'कैसे बनाएँ', apply: 'कैसे लगाएँ',
        fertiliser: 'खाद', purpose: 'क्यों', dose: 'कितना', often: 'कितनी बार', organicAlt: 'जैविक विकल्प',
        watering: 'सिंचाई', frequency: 'कितनी बार', bestTime: 'सबसे अच्छा समय',
        conditions: 'उगाने की स्थिति', temp: 'तापमान', humidity: 'नमी', sunlight: 'धूप', ph: 'मिट्टी pH',
        tips: 'अच्छी आदतें', officer: 'यह दूसरी राय है। छिड़काव से पहले दवा की मात्रा कृषि अधिकारी या दुकान से पूछें।',
        saved: 'आपके इतिहास में सहेजा गया', again: 'फिर से स्कैन करें', talk: 'इस पौधे से बात करें', callMe: '30 सेकंड में कॉल करो', phoneCall: 'मेरे फ़ोन पर कॉल करो', phoneTitle: 'आपका पौधा आपके फ़ोन पर कॉल करेगा', phoneName: 'आपका नाम', phoneNum: 'मोबाइल नंबर', phoneConsent: 'मैं अपने पौधे (CropMagix) से कॉल पाने के लिए सहमत हूँ। कभी भी मना कर सकता हूँ।', phoneGo: 'अभी कॉल करो', phoneCancel: 'रद्द करें', phoneRinging: 'आपके फ़ोन पर कॉल जा रही है। शुरुआत तेलुगु में होगी, हिंदी में बोलेंगे तो हिंदी में बात होगी।', phoneErr: 'कॉल नहीं हो सकी', phoneNotSetup: 'फ़ोन कॉल अभी सेट नहीं है।', callSet: 'आपका पौधा 30 सेकंड में आपको कॉल करेगा। ऐप खुला रखें।',
    },
    te: {
        nameUnsure: 'పేరు ఖచ్చితంగా తెలియదు. ఇది వీటిలో ఒకటా?', noPlant: 'ఫోటోలో మొక్క కనిపించలేదు. ఉంటే, దాని పేరు రాయండి.', pickName: 'సరైన మొక్కను ఎంచుకోండి లేదా పేరు రాయండి.',
        wrongName: 'మొక్క పేరు తప్పా?', typeName: 'మొక్క పేరు రాయండి', useName: 'మళ్ళీ చూడండి', nameSure: (n) => `పేరు ${n}% ఖచ్చితం`,
        unsure: 'ఇంకా ఖచ్చితంగా తెలియదు', healthy: 'ఆరోగ్యంగా ఉంది', serious: 'తీవ్రమైన సమస్య', care: 'జాగ్రత్త అవసరం',
        unsureSub: (p) => `${p ? `బహుశా ${p} కావచ్చు. ` : ''}పగటి వెలుగులో ఆకుకు దగ్గరగా ఇంకో ఫోటో తీయండి, లేదా వ్యవసాయ అధికారికి చూపించండి.`,
        healthySub: 'కొన్ని రోజులకు ఒకసారి మొక్కను చూస్తూ ఉండండి.',
        seriousSub: (p) => `${p ? `బహుశా ${p}. ` : ''}త్వరగా వ్యవసాయ అధికారికి చూపించండి.`,
        careSub: (p) => (p ? `బహుశా ${p}. ఏం చేయాలో కింద ఉంది.` : 'ఏం చేయాలో కింద ఉంది.'),
        sure: (n) => `సుమారు ${n}% ఖచ్చితం`,
        stage: 'పెరుగుదల దశ', today: 'ఈ రోజు ఏం చేయాలి', todayHint: 'ప్రతి పని అయ్యాక గుర్తు పెట్టండి.',
        diagnosis: 'నిర్ధారణ', problem: 'సమస్య', type: 'రకం', severity: 'తీవ్రత', urgency: 'అత్యవసరం', outlook: 'తర్వాత', affected: 'ప్రభావితం',
        why: 'ఇది ఎందుకు జరిగింది', prevention: 'నివారణ', likely: 'అవకాశం',
        plan: 'చికిత్స ప్రణాళిక', daily: 'ప్రతి రోజు', weekly: 'ప్రతి వారం', longTerm: 'తర్వాతి కాలం',
        organic: 'సేంద్రియ పద్ధతులు', ingredients: 'కావలసినవి', preparation: 'తయారీ', apply: 'వాడే విధానం',
        fertiliser: 'ఎరువు', purpose: 'ఎందుకు', dose: 'ఎంత', often: 'ఎన్ని సార్లు', organicAlt: 'సేంద్రియ ప్రత్యామ్నాయం',
        watering: 'నీటి పారుదల', frequency: 'ఎన్ని సార్లు', bestTime: 'మంచి సమయం',
        conditions: 'పెరిగే పరిస్థితులు', temp: 'ఉష్ణోగ్రత', humidity: 'తేమ', sunlight: 'ఎండ', ph: 'నేల pH',
        tips: 'మంచి అలవాట్లు', officer: 'ఇది రెండో అభిప్రాయం మాత్రమే. పిచికారీ ముందు మోతాదును వ్యవసాయ అధికారి లేదా షాపులో అడగండి.',
        saved: 'మీ చరిత్రలో సేవ్ అయింది', again: 'మళ్ళీ స్కాన్ చేయండి', talk: 'ఈ మొక్కతో మాట్లాడండి', callMe: '30 సెకన్లలో కాల్ చేయి', phoneCall: 'నా ఫోన్‌కు కాల్ చేయి', phoneTitle: 'మీ మొక్క మీ ఫోన్‌కు కాల్ చేస్తుంది', phoneName: 'మీ పేరు', phoneNum: 'మొబైల్ నంబర్', phoneConsent: 'నా మొక్క (CropMagix) నుండి కాల్స్ రావడానికి నేను అంగీకరిస్తున్నాను. ఎప్పుడైనా ఆపమని చెప్పవచ్చు.', phoneGo: 'ఇప్పుడే కాల్ చేయి', phoneCancel: 'రద్దు', phoneRinging: 'మీ ఫోన్‌కు కాల్ వెళ్తోంది. తెలుగులో మొదలవుతుంది.', phoneErr: 'కాల్ చేయలేకపోయాను', phoneNotSetup: 'ఫోన్ కాల్స్ ఇంకా సెటప్ కాలేదు.', callSet: 'మీ మొక్క 30 సెకన్లలో మీకు కాల్ చేస్తుంది. యాప్ తెరిచే ఉంచండి.',
    },
};

function verdictOf(r, c) {
    const issue = (r.diagnosis?.primary_issue || r.diseases?.[0]?.name || '').toLowerCase();
    if (r.confidence != null && r.confidence < UNSURE_BELOW) return { cls: 'unsure', Icon: HelpCircle, title: c.unsure, sub: c.unsureSub(issue) };
    if (r.health_status === 'healthy') return { cls: 'healthy', Icon: CheckCircle2, title: c.healthy, sub: c.healthySub };
    if (r.health_status === 'critical') return { cls: 'serious', Icon: AlertTriangle, title: c.serious, sub: c.seriousSub(issue) };
    return { cls: 'care', Icon: CircleAlert, title: c.care, sub: c.careSub(issue) };
}

const list = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);
const text = (x) => (typeof x === 'string' ? x : x?.text || x?.tip || x?.name || '');

const STOP = new Set(['the', 'a', 'an', 'and', 'to', 'of', 'in', 'on', 'today', 'it', 'them', 'all', 'any', 'with', 'for']);
const words = (x) => new Set(x.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w)));
/** Two steps say the same thing when most of their meaningful words overlap. */
const sameStep = (a, b) => {
    const A = words(a);
    const B = words(b);
    if (!A.size || !B.size) return false;
    let shared = 0;
    A.forEach((w) => { if (B.has(w)) shared += 1; });
    return shared / Math.min(A.size, B.size) >= 0.6;
};

/** Today's steps: the immediate treatment first, then the top recommendations, without repeats. */
function todaySteps(r) {
    const out = [];
    for (const s of [...list(r.treatment_plan?.immediate), ...list(r.recommendations)].map(text)) {
        if (s && !out.some((o) => sameStep(o, s))) out.push(s);
        if (out.length === 5) break;
    }
    return out;
}

/**
 * The plant's name, checked by the farmer: when the naming step was unsure (or found no plant) the look-alikes
 * are offered right away; otherwise a small "Wrong plant name?" opens the same choices. Picking one redoes the report.
 */
function NameCheck({ r, c, onCorrectPlant }) {
    const idn = r.identification;
    const unsure = !!r.not_plant || (!!idn && !idn.given && idn.confidence != null && idn.confidence < NAME_UNSURE_BELOW);
    const [open, setOpen] = useState(unsure);
    const [name, setName] = useState('');
    if (!onCorrectPlant) return null;
    if (!open) return <button type="button" className="rep-name-wrong" onClick={() => setOpen(true)}>{c.wrongName}</button>;
    const alts = list(idn?.alternatives).filter((a) => a.plant_name);
    const submit = (e) => {
        e.preventDefault();
        if (name.trim()) onCorrectPlant(name.trim());
    };
    return (
        <div className="rep-namecheck">
            <p>{r.not_plant ? c.noPlant : unsure && alts.length ? c.nameUnsure : c.pickName}</p>
            {alts.length > 0 && (
                <div className="rep-name-alts">
                    {alts.map((a) => (
                        <button key={a.plant_name} type="button" onClick={() => onCorrectPlant(a.plant_name, a.scientific_name)}>
                            <b>{a.plant_name}</b>
                            {a.scientific_name && <i>{a.scientific_name}</i>}
                            {a.how_to_tell && <span>{a.how_to_tell}</span>}
                        </button>
                    ))}
                </div>
            )}
            <form className="rep-name-form" onSubmit={submit}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={c.typeName} aria-label={c.typeName} maxLength={120} />
                <button type="submit" className="nb-btn nb-btn-secondary" disabled={!name.trim()}>{c.useName}</button>
            </form>
        </div>
    );
}

function Section({ icon: Icon, title, open, children }) {
    return (
        <details className="rep-sec" open={open}>
            <summary>
                <Icon size={18} aria-hidden="true" />
                <span>{title}</span>
                <ChevronDown className="rep-chev" size={18} aria-hidden="true" />
            </summary>
            <div className="rep-sec-body">{children}</div>
        </details>
    );
}

export default function ScanReport({ result: r, image, language = 'en', onScanAgain, onTalk, onCorrectPlant }) {
    const c = COPY[language] || COPY.en;
    const [done, setDone] = useState(() => new Set());
    const [callSet, setCallSet] = useState(false);
    const [phoneOpen, setPhoneOpen] = useState(false);
    const [phoneState, setPhoneState] = useState('');   // '' | sending | ringing | error text
    const [farmer, setFarmer] = useState(() => {
        try { return JSON.parse(localStorage.getItem('cropmagix-farmer') || '{}'); } catch { return {}; }
    });

    // Real phone call through the Sarvam "CropMagix" agent, with this scan as its context.
    const callPhone = async (e) => {
        e.preventDefault();
        localStorage.setItem('cropmagix-farmer', JSON.stringify(farmer));
        setPhoneState('sending');
        try {
            const res = await fetch('/api/call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: farmer.phone, farmerName: farmer.name ? `${farmer.name} garu` : 'farmer', consent: !!farmer.consent,
                    plant: r.plant_type || r.plant_name, issue: r.diagnosis?.primary_issue || r.diseases?.[0]?.name || 'none',
                    healthStatus: r.health_status === 'healthy' ? 'healthy' : r.health_status === 'critical' ? 'serious' : 'needs_attention',
                    confidence: r.confidence, todo: steps, reason: 'follow_up',
                }),
            });
            const j = await res.json();
            if (res.status === 501) throw new Error(c.phoneNotSetup);
            if (!res.ok) throw new Error(j.detail || j.error || c.phoneErr);
            setPhoneState('ringing');
        } catch (err) {
            setPhoneState(`${c.phoneErr}: ${err.message}`);
        }
    };

    // "Your plant calls you back": ring in 30 s, answered in the live camera.
    const callMe = () => {
        scheduleCall({ plant: r.plant_type || r.plant_name, issue: r.diagnosis?.primary_issue || r.diseases?.[0]?.name, healthStatus: r.health_status, language }, 30000);
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
        setCallSet(true);
    };
    const [wide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
    const v = verdictOf(r, c);
    const conf = r.confidence != null ? Math.round(r.confidence) : null;
    const steps = todaySteps(r);
    const d = r.diagnosis || {};
    const disease = list(r.diseases)[0] || {};
    const plan = r.treatment_plan || {};
    const cond = r.ideal_conditions || {};
    const water = r.watering_schedule || {};

    const toggle = (i) => setDone((s) => {
        const n = new Set(s);
        if (n.has(i)) n.delete(i); else n.add(i);
        return n;
    });

    const facts = [
        [c.problem, d.primary_issue || disease.name],
        [c.type, disease.type],
        [c.severity, disease.severity],
        [c.urgency, d.urgency_level],
        [c.outlook, d.prognosis],
        [c.affected, list(disease.affected_parts).join(', ')],
    ].filter(([, val]) => val);

    return (
        <article className="rep">
            <header className="rep-head">
                {image && <img className="rep-photo" src={image} alt="" />}
                <div className="rep-head-main">
                    <p className="rep-plant">
                        <Sprout size={16} aria-hidden="true" />
                        <span className="rep-plant-name">{r.plant_type || r.plant_name || '—'}</span>
                        {r.plant_species && <i>{r.plant_species}</i>}
                        {r.identification?.confidence != null && !r.identification.given && !r.not_plant && (
                            <span className="rep-name-conf">{c.nameSure(Math.round(r.identification.confidence))}</span>
                        )}
                    </p>
                    <NameCheck r={r} c={c} onCorrectPlant={onCorrectPlant} />
                    <div className={`rep-verdict ${v.cls}`} role="status">
                        <v.Icon size={30} strokeWidth={2} aria-hidden="true" />
                        <div>
                            <h3>{v.title}</h3>
                            <p>{v.sub}</p>
                        </div>
                    </div>
                    {conf != null && (
                        <div className={`rep-conf ${v.cls}`}>
                            <span className="rep-conf-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, conf))}%` }} /></span>
                            <span className="rep-conf-num">{c.sure(conf)}</span>
                        </div>
                    )}
                    {r.growth_stage && <p className="rep-meta">{c.stage}: {r.growth_stage}</p>}
                </div>
            </header>

            {r.summary && <p className="rep-summary">{r.summary}</p>}

            {steps.length > 0 && (
                <section className="rep-today">
                    <h4>{c.today}</h4>
                    <p className="rep-hint">{c.todayHint}</p>
                    <ol>
                        {steps.map((s, i) => (
                            <li key={i} className={done.has(i) ? 'is-done' : ''}>
                                <button type="button" onClick={() => toggle(i)} aria-pressed={done.has(i)}>
                                    <span className="rep-check" aria-hidden="true">{done.has(i) ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                                    <span>{s}</span>
                                </button>
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {facts.length > 0 && (
                <section className="rep-diag">
                    <h4>{c.diagnosis}</h4>
                    <dl>
                        {facts.map(([k, val]) => (
                            <div key={k}><dt>{k}</dt><dd>{val}</dd></div>
                        ))}
                    </dl>
                    {disease.description && <p className="rep-desc">{disease.description}</p>}
                </section>
            )}

            <div className="rep-secs">
                {list(r.causes).length > 0 && (
                    <Section icon={WhyIcon} title={c.why} open={wide}>
                        <ul className="rep-list">
                            {list(r.causes).map((x, i) => (
                                <li key={i}>
                                    <b>{x.factor}</b>{x.likelihood && <span className={`rep-pill ${x.likelihood}`}>{x.likelihood} {c.likely}</span>}
                                    {x.explanation && <p>{x.explanation}</p>}
                                    {x.prevention && <p className="rep-sub"><ShieldCheck size={14} aria-hidden="true" /> {c.prevention}: {x.prevention}</p>}
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {(list(plan.daily).length || list(plan.weekly).length || list(plan.long_term).length) > 0 && (
                    <Section icon={Activity} title={c.plan} open={wide}>
                        <div className="rep-timeline">
                            {[[c.daily, plan.daily], [c.weekly, plan.weekly], [c.longTerm, plan.long_term]].map(([label, items]) => list(items).length > 0 && (
                                <div key={label} className="rep-step">
                                    <h5>{label}</h5>
                                    <ul>{list(items).map((x, i) => <li key={i}>{text(x)}</li>)}</ul>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {list(r.organic_remedies).length > 0 && (
                    <Section icon={Leaf} title={c.organic} open={wide}>
                        <ul className="rep-list">
                            {list(r.organic_remedies).map((x, i) => (
                                <li key={i}>
                                    <b>{x.name}</b>
                                    {x.ingredients && <p><span className="rep-k">{c.ingredients}:</span> {Array.isArray(x.ingredients) ? x.ingredients.join(', ') : x.ingredients}</p>}
                                    {x.preparation && <p><span className="rep-k">{c.preparation}:</span> {x.preparation}</p>}
                                    {x.application && <p><span className="rep-k">{c.apply}:</span> {x.application}</p>}
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {list(r.fertilizer_recommendations).length > 0 && (
                    <Section icon={FlaskConical} title={c.fertiliser} open={wide}>
                        <ul className="rep-list">
                            {list(r.fertilizer_recommendations).map((x, i) => (
                                <li key={i}>
                                    <b>{x.type || x.name}</b>
                                    {x.purpose && <p><span className="rep-k">{c.purpose}:</span> {x.purpose}</p>}
                                    {x.dosage && <p><span className="rep-k">{c.dose}:</span> {x.dosage}</p>}
                                    {x.frequency && <p><span className="rep-k">{c.often}:</span> {x.frequency}</p>}
                                    {x.organic_alternative && <p className="rep-sub"><Leaf size={14} aria-hidden="true" /> {c.organicAlt}: {x.organic_alternative}</p>}
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {(water.frequency || water.best_time || water.current_recommendation) && (
                    <Section icon={Droplets} title={c.watering} open={wide}>
                        <dl className="rep-kv">
                            {water.frequency && <div><dt>{c.frequency}</dt><dd>{water.frequency}</dd></div>}
                            {water.best_time && <div><dt>{c.bestTime}</dt><dd>{water.best_time}</dd></div>}
                        </dl>
                        {water.current_recommendation && <p className="rep-callout">{water.current_recommendation}</p>}
                    </Section>
                )}

                {(cond.temperature_optimal || cond.humidity || cond.sunlight_hours || cond.soil_ph) && (
                    <Section icon={Sun} title={c.conditions} open={wide}>
                        <div className="rep-grid">
                            {cond.temperature_optimal && <div><Thermometer size={18} aria-hidden="true" /><span>{c.temp}</span><b>{cond.temperature_optimal}</b></div>}
                            {cond.humidity && <div><Droplets size={18} aria-hidden="true" /><span>{c.humidity}</span><b>{cond.humidity}</b></div>}
                            {cond.sunlight_hours && <div><Sun size={18} aria-hidden="true" /><span>{c.sunlight}</span><b>{cond.sunlight_hours}</b></div>}
                            {cond.soil_ph && <div><FlaskConical size={18} aria-hidden="true" /><span>{c.ph}</span><b>{cond.soil_ph}</b></div>}
                        </div>
                    </Section>
                )}

                {list(r.quick_tips).length > 0 && (
                    <Section icon={Lightbulb} title={c.tips} open={wide}>
                        <ul className="rep-list">
                            {list(r.quick_tips).map((x, i) => (
                                <li key={i}><b>{x.title}</b>{x.tip && <p>{x.tip}</p>}</li>
                            ))}
                        </ul>
                    </Section>
                )}
            </div>

            <p className="rep-officer"><ShieldCheck size={16} aria-hidden="true" /> {c.officer}</p>

            {phoneOpen && (
                <form className="rep-phone" onSubmit={callPhone}>
                    <h4><PhoneCall size={18} aria-hidden="true" /> {c.phoneTitle}</h4>
                    <label>{c.phoneName}<input value={farmer.name || ''} onChange={(e) => setFarmer({ ...farmer, name: e.target.value })} autoComplete="name" /></label>
                    <label>{c.phoneNum}<input value={farmer.phone || ''} onChange={(e) => setFarmer({ ...farmer, phone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="98765 43210" required /></label>
                    <label className="rep-consent"><input type="checkbox" checked={!!farmer.consent} onChange={(e) => setFarmer({ ...farmer, consent: e.target.checked })} required /> {c.phoneConsent}</label>
                    {phoneState && phoneState !== 'sending' && <p className={phoneState === 'ringing' ? 'rep-ok' : 'rep-err'} role="status">{phoneState === 'ringing' ? c.phoneRinging : phoneState}</p>}
                    <div>
                        <button type="button" className="nb-btn nb-btn-secondary" onClick={() => { setPhoneOpen(false); setPhoneState(''); }}>{c.phoneCancel}</button>
                        <button type="submit" className="nb-btn nb-btn-primary" disabled={phoneState === 'sending'}><PhoneCall size={16} aria-hidden="true" /> {c.phoneGo}</button>
                    </div>
                </form>
            )}

            <footer className="rep-actions">
                {r.not_plant ? <span /> : <span className="rep-saved"><Check size={14} aria-hidden="true" /> {callSet ? c.callSet : c.saved}</span>}
                <div>
                    <button type="button" className="nb-btn nb-btn-secondary" onClick={onScanAgain}><RotateCcw size={16} aria-hidden="true" /> {c.again}</button>
                    <button type="button" className="nb-btn nb-btn-secondary" onClick={() => setPhoneOpen(true)}><PhoneCall size={16} aria-hidden="true" /> {c.phoneCall}</button>
                    <button type="button" className="nb-btn nb-btn-secondary" onClick={callMe} disabled={callSet}><PhoneIncoming size={16} aria-hidden="true" /> {c.callMe}</button>
                    {onTalk && <button type="button" className="nb-btn nb-btn-primary" onClick={onTalk}><Mic size={16} aria-hidden="true" /> {c.talk}</button>}
                </div>
            </footer>
        </article>
    );
}
