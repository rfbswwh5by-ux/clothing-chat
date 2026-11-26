"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Camera, Check, ChevronDown, CloudRain, CloudSun, Footprints, LoaderCircle, Menu, MessageCircle, Plus, Shirt, Sparkles, Sun, Trash2, Umbrella, Wind, X } from "lucide-react";
import type { ClosetItem, WeatherInfo } from "@/lib/types";

type Message = { role: "user" | "assistant"; content: string };
type DraftItem = Omit<ClosetItem, "id" | "addedAt">;
const STORAGE_KEY = "forme-closet-v1";
const starterPrompts = ["Build me a casual outfit for today", "I have a dinner date tonight", "Style a smart casual outfit", "I want a clean, elevated streetwear look"];
const categories = ["All", "Tops", "Bottoms", "Outerwear", "Shoes", "Accessories", "Bags", "Activewear", "Formalwear", "Other"];

function getSeason(date = new Date()) {
  const m = date.getMonth();
  if (m === 11 || m <= 1) return "Winter";
  if (m <= 4) return "Spring";
  if (m <= 7) return "Summer";
  return "Fall";
}
function weatherText(code: number) {
  if (code === 0) return "Clear sky";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Mixed conditions";
}
function toF(c: number) { return Math.round(c * 9 / 5 + 32); }

export default function StyleApp() {
  const [tab, setTab] = useState<"stylist" | "closet">("stylist");
  const [closet, setCloset] = useState<ClosetItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Hey, I'm your personal stylist. Tell me where you're going, what kind of look you're after, or how you want to feel. I'll build around what you already own." }]);
  const [input, setInput] = useState("");
  const [style, setStyle] = useState("Personal style");
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherStatus, setWeatherStatus] = useState("Getting local weather…");
  const [localTime, setLocalTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [draft, setDraft] = useState<DraftItem | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const season = getSeason();

  useEffect(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setCloset(JSON.parse(saved)); } catch { /* ignore invalid local data */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(closet)); } catch { /* storage may be full; photos are compressed before saving */ } }, [closet]);
  useEffect(() => {
    const tick = () => setLocalTime(new Intl.DateTimeFormat(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" }).format(new Date()));
    tick(); const timer = window.setInterval(tick, 60_000); return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { loadWeather(); }, []);

  async function loadWeather() {
    if (!navigator.geolocation) { setWeatherStatus("Location unavailable"); return; }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
        const res = await fetch(url); if (!res.ok) throw new Error("Weather request failed");
        const data = await res.json(); const c = data.current;
        setWeather({ temperature: Math.round(c.temperature_2m), feelsLike: Math.round(c.apparent_temperature), description: weatherText(c.weather_code), precipitation: c.precipitation, windSpeed: Math.round(c.wind_speed_10m), units: "fahrenheit" });
        setWeatherStatus("Live local weather");
      } catch { setWeatherStatus("Weather unavailable"); }
    }, () => setWeatherStatus("Enable location for local weather"), { timeout: 10000, maximumAge: 15 * 60 * 1000 });
  }

  async function sendMessage(text = input) {
    const message = text.trim(); if (!message || loading) return;
    setInput(""); setMessages(prev => [...prev, { role: "user", content: message }]); setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, closet: closet.map(({ image, ...item }) => item), weather, season, localTime, style }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Something went wrong");
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (error) { setMessages(prev => [...prev, { role: "assistant", content: error instanceof Error ? error.message : "Please try again." }]); }
    finally { setLoading(false); }
  }

  function resizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onerror = () => reject(new Error("Couldn't read this file."));
      reader.onload = () => {
        const img = new Image(); img.onerror = () => reject(new Error("Please upload a photo."));
        img.onload = () => { const scale = Math.min(1, 1400 / Math.max(img.width, img.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale); const ctx = canvas.getContext("2d"); if (!ctx) return reject(new Error("Image processing isn't supported.")); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", 0.78)); };
        img.src = String(reader.result);
      }; reader.readAsDataURL(file);
    });
  }

  async function handlePhoto(file?: File) {
    if (!file) return; setScanError(""); setScanning(true); setShowAdd(true);
    try {
      const image = await resizeImage(file);
      const res = await fetch("/api/analyze-item", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, hint: "Identify the clothing item and read its tag if visible." }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Unable to analyze image");
      setDraft({ ...data.item, image });
    } catch (error) { setScanError(error instanceof Error ? error.message : "Unable to scan this item."); }
    finally { setScanning(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  function saveItem() {
    if (!draft) return;
    setCloset(prev => [{ ...draft, id: crypto.randomUUID(), addedAt: new Date().toISOString() }, ...prev]);
    setDraft(null); setShowAdd(false); setTab("closet");
  }
  function updateDraft(key: keyof DraftItem, value: string) { setDraft(prev => prev ? { ...prev, [key]: value } : prev); }
  const filtered = useMemo(() => closet.filter(item => (filter === "All" || item.category === filter) && `${item.name} ${item.brand || ""} ${item.color}`.toLowerCase().includes(search.toLowerCase())), [closet, filter, search]);

  return <main className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark">F</div><div><div className="brand-name">FORME<span>.</span></div><div className="brand-sub">PERSONAL STYLE, REFINED</div></div><button className="icon-btn mobile-close" onClick={() => setMobileMenu(false)}><X size={18}/></button></div>
      <div className="side-label">YOUR SPACE</div>
      <button className={`nav-item ${tab === "stylist" ? "active" : ""}`} onClick={() => { setTab("stylist"); setMobileMenu(false); }}><MessageCircle size={18}/> AI Stylist <span className="nav-dot"/></button>
      <button className={`nav-item ${tab === "closet" ? "active" : ""}`} onClick={() => { setTab("closet"); setMobileMenu(false); }}><Shirt size={18}/> My Closet <span className="nav-count">{closet.length}</span></button>
      <div className="sidebar-bottom"><div className="weather-card"><div className="weather-top"><span>YOUR CONDITIONS</span><CloudSun size={17}/></div><div className="weather-temp">{weather ? `${weather.temperature}°` : "--°"}</div><div className="weather-desc">{weather?.description || weatherStatus}</div><div className="weather-meta">{weather ? `Feels like ${weather.feelsLike}° · Wind ${weather.windSpeed} mph` : "Allow location access"}</div><button className="weather-refresh" onClick={loadWeather}>Refresh weather ↗</button></div><div className="profile-row"><div className="avatar">Y</div><div><div className="profile-name">Your wardrobe</div><div className="profile-plan">Personal stylist</div></div><ChevronDown size={15} className="muted"/></div></div>
    </aside>

    <section className="main-panel">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={() => setMobileMenu(true)}><Menu size={19}/></button><div className="eyebrow">{tab === "stylist" ? "YOUR PERSONAL STYLIST" : "YOUR DIGITAL WARDROBE"}</div></div><div className="topbar-right"><span className="season-pill"><Sun size={14}/>{season.toUpperCase()}</span><span className="time-label">{localTime}</span></div></header>

      {tab === "stylist" ? <div className="stylist-layout"><div className="chat-column"><div className="welcome-block"><div className="welcome-kicker"><Sparkles size={14}/> THE ART OF GETTING DRESSED</div><h1>Get dressed.<br/><span>With intention.</span></h1><p>Your closet, the weather, your plans. One thoughtful outfit at a time.</p></div>
        <div className="chat-messages">{messages.map((m, i) => <div key={i} className={`message-row ${m.role}`}><div className={`message-avatar ${m.role === "assistant" ? "forme-avatar" : "you-avatar"}`}>{m.role === "assistant" ? "F" : "Y"}</div><div className="message-content"><div className="message-author">{m.role === "assistant" ? "FORME STYLIST" : "YOU"}</div><div className="message-bubble">{m.content.split("\n").map((line, j) => <span key={j}>{line}{j < m.content.split("\n").length - 1 && <br/>}</span>)}</div></div></div>)}{loading && <div className="message-row assistant"><div className="message-avatar forme-avatar">F</div><div className="typing"><span/><span/><span/></div></div>}<div ref={chatEndRef}/></div>
        <div className="composer-wrap"><div className="suggestions">{starterPrompts.map(p => <button key={p} onClick={() => sendMessage(p)}>{p}</button>)}</div><form className="composer" onSubmit={e => { e.preventDefault(); sendMessage(); }}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Tell me what you're dressing for…" maxLength={4000}/><button type="submit" disabled={!input.trim() || loading} aria-label="Send message">{loading ? <LoaderCircle className="spin" size={18}/> : <ArrowUp size={19}/>}</button></form><div className="composer-foot"><span>FORME CONSIDERS YOUR CLOSET + LOCAL CONDITIONS</span><span>{closet.length} ITEMS IN YOUR CLOSET</span></div></div>
      </div><aside className="right-rail"><div className="rail-heading">YOUR STYLE PROFILE</div><div className="profile-card"><div className="profile-card-icon"><Sparkles size={17}/></div><h3>Make it yours.</h3><p>Tell FORME what you like, what you avoid, and how you want your clothes to fit. Your stylist gets smarter with every conversation.</p><button onClick={() => setInput("Help me define my personal style. Ask me a few questions about the looks, colors, and fits I like.")}>Define my style <ArrowUp size={14}/></button></div><div className="rail-section"><div className="rail-section-title">THE DAILY EDIT <span>LIVE</span></div><div className="condition-row"><div className="condition-icon"><CloudSun size={17}/></div><div><b>{weather ? weather.description : "Weather check"}</b><small>{weather ? `Feels like ${weather.feelsLike}°F` : weatherStatus}</small></div></div><div className="condition-row"><div className="condition-icon"><Sun size={17}/></div><div><b>{season} season</b><small>Based on your local calendar</small></div></div><div className="condition-row"><div className="condition-icon"><Wind size={17}/></div><div><b>{weather ? `${weather.windSpeed} mph wind` : "Wind conditions"}</b><small>{weather ? `${weather.precipitation} mm precipitation` : "Waiting for weather"}</small></div></div></div><div className="closet-mini"><div className="closet-mini-head"><span>YOUR WARDROBE</span><button onClick={() => setTab("closet")}>VIEW ALL ↗</button></div><div className="mini-count">{closet.length.toString().padStart(2, "0")} <span>pieces and counting</span></div><div className="mini-bar"><div style={{ width: `${Math.min(100, closet.length * 4)}%` }}/></div><button className="add-piece" onClick={() => { setShowAdd(true); setDraft(null); }}><Plus size={15}/> Add a new piece</button></div></aside></div>
      : <div className="closet-page"><div className="closet-header"><div><div className="welcome-kicker"><Shirt size={14}/> YOUR PERSONAL COLLECTION</div><h1>Your closet<span>.</span></h1><p>Everything you own. Ready to be styled.</p></div><button className="primary-btn" onClick={() => { setShowAdd(true); setDraft(null); }}><Plus size={17}/> Add an item</button></div><div className="closet-toolbar"><div className="category-tabs">{categories.map(c => <button key={c} className={filter === c ? "selected" : ""} onClick={() => setFilter(c)}>{c}</button>)}</div><input className="search-input" placeholder="Search your closet…" value={search} onChange={e => setSearch(e.target.value)}/></div>{filtered.length ? <div className="closet-grid">{filtered.map(item => <article className="item-card" key={item.id}><div className="item-photo">{item.image ? <img src={item.image} alt={item.name}/> : <div className="no-photo"><Shirt size={32}/></div>}<button className="delete-item" title="Remove item" onClick={() => setCloset(prev => prev.filter(x => x.id !== item.id))}><Trash2 size={15}/></button></div><div className="item-info"><div className="item-category">{item.category}</div><h3>{item.name}</h3><p>{[item.color, item.brand].filter(Boolean).join(" · ")}</p></div></article>)}</div> : <div className="empty-closet"><div className="empty-icon"><Shirt size={28}/></div><h2>Your wardrobe starts here.</h2><p>Scan a clothing tag, photograph an item, or upload a picture. FORME will organize it for you.</p><button className="primary-btn" onClick={() => { setShowAdd(true); setDraft(null); }}><Camera size={16}/> Scan your first item</button></div>}</div>}
    </section>

    {showAdd && <div className="modal-backdrop" onClick={() => { setShowAdd(false); setDraft(null); setScanError(""); }}><div className="add-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><div className="welcome-kicker">BUILD YOUR WARDROBE</div><h2>Add to your closet</h2></div><button className="icon-btn" onClick={() => { setShowAdd(false); setDraft(null); }}><X size={19}/></button></div>{!draft ? <><button className="upload-zone" onClick={() => fileRef.current?.click()} disabled={scanning}>{scanning ? <LoaderCircle className="spin" size={30}/> : <Camera size={30}/>}<b>{scanning ? "Analyzing your item…" : "Scan a tag or upload a photo"}</b><span>Take a photo of the item or its label. Add or confirm its details before saving.</span><em>JPG, PNG, WEBP · MAX 4 MB</em></button><input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden-input" onChange={e => handlePhoto(e.target.files?.[0])}/>{scanError && <div className="error-text">{scanError}</div>}<div className="manual-divider"><span>OR ADD DETAILS MANUALLY</span></div><button className="manual-add" onClick={() => setDraft({ name: "", category: "Tops", color: "", brand: "", material: "", fit: "", season: "All-season", notes: "" })}><Plus size={16}/> Enter item details</button></> : <><div className="scan-preview">{draft.image && <img src={draft.image} alt="Scanned item"/>}<div><div className="scan-success"><Check size={13}/> REVIEW ITEM</div><b>Review the details</b><small>AI can make mistakes. Edit anything that needs correcting.</small></div></div><div className="form-grid"><label className="full-field">Item name<input value={draft.name || ""} onChange={e => updateDraft("name", e.target.value)}/></label><label>Category<select value={draft.category || "Other"} onChange={e => updateDraft("category", e.target.value)}>{categories.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}</select></label><label>Color<input value={draft.color || ""} onChange={e => updateDraft("color", e.target.value)} placeholder="e.g. Navy"/></label><label>Brand<input value={draft.brand || ""} onChange={e => updateDraft("brand", e.target.value)} placeholder="Brand (optional)"/></label><label>Material<input value={draft.material || ""} onChange={e => updateDraft("material", e.target.value)} placeholder="e.g. Cotton"/></label><label>Fit<input value={draft.fit || ""} onChange={e => updateDraft("fit", e.target.value)} placeholder="e.g. Relaxed"/></label><label>Season<select value={draft.season || "All-season"} onChange={e => updateDraft("season", e.target.value)}>{["All-season", "Spring/Summer", "Fall/Winter", "Spring", "Summer", "Fall", "Winter", "Unknown"].map(c => <option key={c}>{c}</option>)}</select></label></div><div className="modal-actions"><button className="secondary-btn" onClick={() => setDraft(null)}>Back</button><button className="primary-btn" disabled={!draft.name?.trim()} onClick={saveItem}><Check size={16}/> Save to closet</button></div></>}</div></div>}
  </main>;
}
