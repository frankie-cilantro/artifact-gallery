import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";

/* ═══════════════════════ SHARED DATA ═══════════════════════ */

const CATEGORIES = {
  energy: { label: "Energy", color: "#E8532E", items: ["Crude Oil (WTI)","Crude Oil (Brent)","Natural Gas","Heating Oil","RBOB Gasoline","Ethanol","Coal","Uranium"], description: "The master input. Energy costs propagate into every other commodity through extraction, refining, transport, and storage." },
  metals_precious: { label: "Precious Metals", color: "#F0C75E", items: ["Gold","Silver","Platinum","Palladium"], description: "Monetary metals + industrial hybrids. Gold/Silver as stores of value; Platinum/Palladium as catalytic converters and industrial inputs." },
  metals_base: { label: "Base Metals", color: "#7EAACD", items: ["Copper","Aluminum","Zinc","Nickel","Lead","Tin","Iron Ore","Steel"], description: "Infrastructure and manufacturing backbone. Copper is the bellwether \u2014 'Dr. Copper' diagnoses the global economy." },
  metals_critical: { label: "Critical/Battery Metals", color: "#9B6FBF", items: ["Lithium","Cobalt","Manganese","Rare Earth Elements","Graphite","Vanadium"], description: "Energy transition metals. Geopolitically concentrated \u2014 China dominates processing." },
  grains: { label: "Grains & Oilseeds", color: "#8DB255", items: ["Corn","Wheat","Soybeans","Soybean Oil","Soybean Meal","Rice","Oats","Canola"], description: "Food security foundation. Corn links to energy (ethanol), livestock (feed), and industrial use." },
  softs: { label: "Softs", color: "#D4915E", items: ["Coffee","Cocoa","Sugar","Cotton","Rubber","Orange Juice","Lumber"], description: "Tropical/agricultural commodities. Weather-sensitive, often produced in developing nations." },
  livestock: { label: "Livestock", color: "#C4726C", items: ["Live Cattle","Feeder Cattle","Lean Hogs","Milk"], description: "Downstream of grains (feed costs). Protein complex." },
  currencies: { label: "Commodity Currencies", color: "#5EA89E", items: ["USD (DXY)","AUD","CAD","BRL","RUB","ZAR","NOK","CLP"], description: "Currencies of resource-exporting nations move with commodity prices." },
  rates: { label: "Rates & Macro", color: "#888888", items: ["Fed Funds Rate","10Y Treasury","TIPS Breakevens","CPI","PPI","Baltic Dry Index"], description: "Interest rates affect carry costs, storage economics, and opportunity cost of holding physical." },
  crypto: { label: "Digital Commodities", color: "#F7931A", items: ["Bitcoin","Ethereum"], description: "Competing monetary asset / store-of-value narrative." }
};

const CONNECTIONS = [
  { from: "energy", to: "grains", label: "Fertilizer + transport + ethanol", strength: 3 },
  { from: "energy", to: "metals_base", label: "Smelting energy costs", strength: 3 },
  { from: "energy", to: "metals_critical", label: "Processing energy", strength: 2 },
  { from: "energy", to: "softs", label: "Transport + processing", strength: 2 },
  { from: "energy", to: "livestock", label: "Feed transport + processing", strength: 1 },
  { from: "energy", to: "metals_precious", label: "Mining energy + inflation hedge", strength: 2 },
  { from: "energy", to: "crypto", label: "Mining energy costs (BTC)", strength: 2 },
  { from: "grains", to: "livestock", label: "Feed costs (corn/soy)", strength: 3 },
  { from: "grains", to: "softs", label: "Land competition + sugar-ethanol", strength: 2 },
  { from: "grains", to: "energy", label: "Ethanol (corn), biodiesel (soy)", strength: 2 },
  { from: "metals_precious", to: "currencies", label: "Gold-USD inverse", strength: 3 },
  { from: "metals_precious", to: "rates", label: "Real rates inversely drive gold", strength: 3 },
  { from: "metals_precious", to: "crypto", label: "Competing SoV narrative", strength: 2 },
  { from: "metals_precious", to: "metals_base", label: "Silver = industrial + monetary", strength: 2 },
  { from: "metals_base", to: "metals_critical", label: "Shared mining/processing", strength: 2 },
  { from: "metals_base", to: "energy", label: "Infrastructure for extraction", strength: 1 },
  { from: "currencies", to: "energy", label: "USD denominator effect", strength: 3 },
  { from: "currencies", to: "metals_base", label: "USD denominator effect", strength: 2 },
  { from: "currencies", to: "grains", label: "USD denominator effect", strength: 2 },
  { from: "rates", to: "currencies", label: "Rate differentials drive FX", strength: 3 },
  { from: "rates", to: "energy", label: "Carry cost, demand outlook", strength: 2 },
  { from: "rates", to: "metals_precious", label: "Opportunity cost of gold", strength: 3 },
  { from: "rates", to: "crypto", label: "Liquidity + risk appetite", strength: 2 },
  { from: "crypto", to: "currencies", label: "Dollar alternative thesis", strength: 1 },
  { from: "metals_critical", to: "energy", label: "Battery storage for renewables", strength: 2 },
  { from: "softs", to: "energy", label: "Rubber for tires, biofuels", strength: 1 },
];

const MACRO_REGIMES = {
  rate_cut: { label: "Fed Cuts Rates", icon: "\u2193", subtitle: "Dam operator opens the gates", description: "Borrowing costs drop. Capital flows toward growth and real assets.", effects: { rates:{pressure:-2,lag:1,mechanism:"Direct \u2014 yields fall, curve steepens"},currencies:{pressure:-2,lag:1,mechanism:"USD weakens \u2014 rate differential narrows"},metals_precious:{pressure:3,lag:1,mechanism:"Real rates drop \u2192 gold\u2019s opportunity cost falls. Dollar weakens"},crypto:{pressure:3,lag:1,mechanism:"Risk appetite + liquidity surge. Dollar weakens"},energy:{pressure:2,lag:2,mechanism:"Weaker dollar lifts prices. Demand outlook improves"},metals_base:{pressure:2,lag:2,mechanism:"Cheaper borrowing \u2192 more construction/manufacturing"},metals_critical:{pressure:2,lag:2,mechanism:"Growth expectations lift EV/renewable capex"},grains:{pressure:1,lag:2,mechanism:"Dollar effect. Food demand is relatively inelastic"},softs:{pressure:1,lag:3,mechanism:"Weak dollar helps, physical supply/weather dominate"},livestock:{pressure:1,lag:3,mechanism:"Feed costs rise but consumer demand improves. Mixed"} } },
  rate_hike: { label: "Fed Hikes Rates", icon: "\u2191", subtitle: "Dam operator tightens the gates", description: "Borrowing costs rise. Capital retreats from speculative assets first.", effects: { rates:{pressure:2,lag:1,mechanism:"Direct \u2014 yields rise, short end leads"},currencies:{pressure:2,lag:1,mechanism:"USD strengthens \u2014 higher yields attract capital"},metals_precious:{pressure:-3,lag:1,mechanism:"Real rates rise \u2192 gold\u2019s zero yield costly. Strong dollar"},crypto:{pressure:-3,lag:1,mechanism:"Liquidity contracts, risk appetite dies"},energy:{pressure:-1,lag:2,mechanism:"Strong dollar pressures prices but OPEC can override"},metals_base:{pressure:-2,lag:2,mechanism:"Tighter money \u2192 less construction. Copper is canary"},metals_critical:{pressure:-2,lag:2,mechanism:"Growth capex shelved. EV forecasts revised down"},grains:{pressure:-1,lag:2,mechanism:"Strong dollar hurts but people still eat"},softs:{pressure:-1,lag:3,mechanism:"Dollar headwind but weather can overwhelm"},livestock:{pressure:0,lag:3,mechanism:"Feed costs drop but consumer spending weakens"} } },
  qe: { label: "QE", icon: "\u25C6", subtitle: "Dam operator creates new water", description: "Reservoir expands. Total dollars increase. Every existing dollar becomes a smaller share.", effects: { rates:{pressure:-3,lag:1,mechanism:"Fed buying bonds suppresses long-term yields"},currencies:{pressure:-3,lag:1,mechanism:"Massive dollar dilution. DXY drops"},metals_precious:{pressure:3,lag:1,mechanism:"Signal the dam has no constraint. Debasement fear"},crypto:{pressure:3,lag:1,mechanism:"Peak \u2018bedrock matters\u2019 moment"},energy:{pressure:2,lag:2,mechanism:"Dollar collapse lifts all dollar-denominated commodities"},metals_base:{pressure:2,lag:2,mechanism:"Reflation trade. Infrastructure spending anticipated"},metals_critical:{pressure:2,lag:2,mechanism:"Green stimulus often accompanies QE"},grains:{pressure:2,lag:2,mechanism:"Weak dollar + speculative commodity index inflows"},softs:{pressure:1,lag:3,mechanism:"Index inflows lift all boats. Physical still dominates"},livestock:{pressure:1,lag:3,mechanism:"Consumer spending recovers. But feed costs rise too"} } },
  qt: { label: "QT", icon: "\u25C7", subtitle: "Dam operator drains the reservoir", description: "Water removed from system. Each remaining gallon is larger share \u2014 but less to go around.", effects: { rates:{pressure:2,lag:1,mechanism:"Fed lets bonds mature. Long yields rise"},currencies:{pressure:2,lag:1,mechanism:"Dollar liquidity draining. USD strengthens"},metals_precious:{pressure:-2,lag:1,mechanism:"Real rates rising + strong dollar"},crypto:{pressure:-2,lag:1,mechanism:"Liquidity is oxygen for crypto. QT removes it"},energy:{pressure:-1,lag:2,mechanism:"Strong dollar headwind. OPEC can override"},metals_base:{pressure:-2,lag:2,mechanism:"Tighter conditions \u2192 weaker industrial outlook"},metals_critical:{pressure:-1,lag:2,mechanism:"Long-term transition story provides floor"},grains:{pressure:-1,lag:2,mechanism:"Dollar strength hurts exports. Harvests dominate"},softs:{pressure:0,lag:3,mechanism:"Least connected to monetary plumbing"},livestock:{pressure:0,lag:3,mechanism:"Cattle cycle on its own 10-year rhythm"} } },
  forward_hawkish: { label: "Hawkish Guidance", icon: "\u25B2", subtitle: "Dam warns: gates closing soon", description: "No action \u2014 just words. Markets price the future, moving assets before action arrives.", effects: { rates:{pressure:1,lag:1,mechanism:"Market prices in hikes. 2Y jumps"},currencies:{pressure:1,lag:1,mechanism:"Dollar firms on expected advantage"},metals_precious:{pressure:-2,lag:1,mechanism:"Forward real rates repriced higher"},crypto:{pressure:-2,lag:1,mechanism:"Speculative assets reprice fastest"},energy:{pressure:0,lag:2,mechanism:"Words don\u2019t change physical supply/demand"},metals_base:{pressure:-1,lag:2,mechanism:"Anticipatory destocking"},metals_critical:{pressure:-1,lag:2,mechanism:"Capex plans don\u2019t change on words"},grains:{pressure:0,lag:3,mechanism:"Farmers plant on weather, not Fed speeches"},softs:{pressure:0,lag:3,mechanism:"Coffee doesn\u2019t care about dot plots"},livestock:{pressure:0,lag:3,mechanism:"Cows don\u2019t watch FOMC pressers"} } },
  forward_dovish: { label: "Dovish Guidance", icon: "\u25BC", subtitle: "Dam signals: gates opening soon", description: "Promise of easier conditions. Markets front-run the easing.", effects: { rates:{pressure:-1,lag:1,mechanism:"Market prices in cuts. Curve steepens"},currencies:{pressure:-1,lag:1,mechanism:"Dollar weakens on expected rate decline"},metals_precious:{pressure:2,lag:1,mechanism:"Forward real rates drop. Gold rallies"},crypto:{pressure:2,lag:1,mechanism:"Risk-on signal. Speculative assets front-run"},energy:{pressure:1,lag:2,mechanism:"Demand outlook improves. Dollar weakens"},metals_base:{pressure:1,lag:2,mechanism:"Manufacturing outlook brightens"},metals_critical:{pressure:1,lag:2,mechanism:"Growth narrative returns"},grains:{pressure:0,lag:3,mechanism:"Modest dollar effect. Physical dominates"},softs:{pressure:0,lag:3,mechanism:"Cocoa fungus doesn\u2019t respond to Powell"},livestock:{pressure:0,lag:3,mechanism:"Very indirect, very lagged"} } },
};

/* ═══════════════════════ GEOPOLITICAL DATA ═══════════════════════ */

const GEO_SCENARIOS = {
  hormuz: {
    label: "Strait of Hormuz Blockade",
    region: "Persian Gulf",
    lat: 26.5, lon: 56.3,
    description: "~21% of global oil and ~25% of global LNG passes through this 21-mile-wide strait. A blockade by Iran would be the most severe energy supply shock possible short of a global war. Insurance rates for tankers would spike immediately, even a threat of closure moves crude $5-10/barrel.",
    flowVolume: "21M barrels/day of oil, ~25% of global LNG",
    keyPlayers: ["Iran", "Saudi Arabia", "UAE", "Qatar", "USA (5th Fleet)"],
    historicalPrecedent: "1988 tanker war, 2019 tanker seizures, Houthi Red Sea attacks 2023-24 as partial preview",
    effects: {
      energy: { pressure: 3, mechanism: "Immediate oil spike $30-60+/barrel. LNG spot prices explode. Natural gas in Europe/Asia surges. Gasoline, heating oil, jet fuel all cascade" },
      metals_precious: { pressure: 3, mechanism: "Classic flight-to-safety. Gold spikes on geopolitical risk premium + inflation expectations from energy shock" },
      crypto: { pressure: 1, mechanism: "Mixed \u2014 BTC may rally as safe haven narrative, but risk-off can hit it too. Depends on whether market treats it as gold-like or equity-like in that moment" },
      currencies: { pressure: 2, mechanism: "USD initially strengthens (safe haven). Commodity currencies of non-Gulf oil exporters (CAD, NOK, RUB) surge. Gulf pegs come under pressure" },
      metals_base: { pressure: -2, mechanism: "Aluminum smelting (energy-intensive) costs explode. Industrial demand outlook darkens on recession fears. Copper drops on growth scare" },
      metals_critical: { pressure: -1, mechanism: "Growth scare hits EV/renewable outlook. But longer-term, energy crisis accelerates transition narrative" },
      grains: { pressure: 2, mechanism: "Fertilizer costs spike (nat gas is key input for ammonia/urea). Transport costs surge. Food inflation fears" },
      softs: { pressure: 1, mechanism: "Transport cost pass-through. Rubber prices up on energy. Less direct than grains" },
      livestock: { pressure: -1, mechanism: "Feed costs explode via grains. Consumer spending contracts. Margin destruction for producers" },
      rates: { pressure: 1, mechanism: "Stagflation dilemma \u2014 inflation spikes but economy weakens. Fed trapped between inflation mandate and growth" },
    }
  },
  malacca: {
    label: "Strait of Malacca Disruption",
    region: "Southeast Asia",
    lat: 2.5, lon: 101.5,
    description: "The world\u2019s busiest shipping lane. ~25% of all traded goods pass through, including 80%+ of China/Japan/Korea\u2019s oil imports. A disruption here is an Asian economic earthquake.",
    flowVolume: "~25% of global trade, 16M barrels/day of oil",
    keyPlayers: ["China", "Malaysia", "Singapore", "Indonesia", "USA (7th Fleet)"],
    historicalPrecedent: "No full closure in modern history \u2014 piracy incidents only. Taiwan contingency could trigger partial disruption",
    effects: {
      energy: { pressure: 3, mechanism: "Asian crude premium explodes. China/Japan/Korea scramble for alternative routes (longer, more expensive). Oil spike $20-40" },
      metals_base: { pressure: -3, mechanism: "China is the world\u2019s largest metals consumer. Supply chains for copper, aluminum, nickel all disrupted. LME chaos" },
      metals_critical: { pressure: -3, mechanism: "China processes 60-80% of global lithium, cobalt, rare earths. Complete supply chain paralysis for battery/EV sector" },
      metals_precious: { pressure: 3, mechanism: "Massive geopolitical risk premium. Gold surges. Silver bifurcates \u2014 monetary up, industrial down" },
      crypto: { pressure: 2, mechanism: "If linked to Taiwan scenario, potential SWIFT weaponization fears drive BTC safe haven narrative" },
      currencies: { pressure: 2, mechanism: "USD safe haven surge. Asian currencies collapse. CNY devaluation risk. AUD hammered (China dependency)" },
      grains: { pressure: 2, mechanism: "Asian grain imports disrupted. Rice supply chains affected. Soybean shipments to China rerouted" },
      softs: { pressure: 2, mechanism: "Rubber (Malaysia/Indonesia are top producers), palm oil, coffee shipping all disrupted" },
      livestock: { pressure: -1, mechanism: "Global feed trade disrupted. Soybean meal flows to Asia interrupted" },
      rates: { pressure: 2, mechanism: "Global recession risk. Flight to US Treasuries \u2014 yields drop on safe haven, rise on inflation. Extreme volatility" },
    }
  },
  blacksea: {
    label: "Black Sea Closure / Escalation",
    region: "Eastern Europe",
    lat: 43.5, lon: 34.0,
    description: "Russia-Ukraine conflict already demonstrated the impact. Full Black Sea closure would eliminate ~12% of global wheat exports, significant corn and sunflower oil. Russia is also a major fertilizer and energy exporter.",
    flowVolume: "~30% of global wheat trade, major fertilizer and energy corridor",
    keyPlayers: ["Russia", "Ukraine", "Turkey (Bosphorus)", "NATO"],
    historicalPrecedent: "2022 Russian invasion \u2014 wheat prices spiked 50%+ in weeks. Grain corridor deal partially restored flows",
    effects: {
      grains: { pressure: 3, mechanism: "Wheat immediately +30-50%. Corn up. Sunflower oil (Ukraine is #1 exporter) disappears from market. Global food crisis" },
      energy: { pressure: 2, mechanism: "Russian pipeline gas to Europe further curtailed. LNG demand spikes. Oil less affected (Russia reroutes to Asia) but sanctions tighten" },
      softs: { pressure: 2, mechanism: "Sunflower oil substitution drives soybean oil, palm oil, canola up. Vegetable oil complex reprices entirely" },
      metals_precious: { pressure: 2, mechanism: "Geopolitical risk + inflation from food/energy. Russia is a major palladium/platinum producer" },
      metals_base: { pressure: 1, mechanism: "Russia exports aluminum, nickel, copper. Sanctions/disruption reduces supply. Nickel especially vulnerable (2022 LME squeeze)" },
      metals_critical: { pressure: 1, mechanism: "Russia supplies ~10% of global nickel, some palladium for catalysts. Supply chain uncertainty premium" },
      currencies: { pressure: 1, mechanism: "EUR weakens (European energy vulnerability). USD strengthens. RUB volatile. Commodity currencies of alternative suppliers benefit" },
      livestock: { pressure: -2, mechanism: "Feed cost explosion. Poultry industry (wheat-dependent) hit hardest. Hog producers face margin crisis" },
      crypto: { pressure: 1, mechanism: "Sanctions evasion narrative + general uncertainty. Russian capital flows into BTC observed in 2022" },
      rates: { pressure: 1, mechanism: "Stagflation pressure again. ECB especially trapped between inflation and recession" },
    }
  },
  suez: {
    label: "Suez Canal Blockage",
    region: "Egypt",
    lat: 30.5, lon: 32.3,
    description: "~12% of global trade passes through. The 2021 Ever Given incident was accidental and lasted 6 days \u2014 a deliberate or prolonged closure would be far worse. Houthi Red Sea attacks in 2023-24 already diverted significant traffic.",
    flowVolume: "~12% of global trade, ~10% of seaborne oil, 8% of LNG",
    keyPlayers: ["Egypt", "Houthi rebels (Yemen)", "Iran (proxy)", "USA/EU naval forces"],
    historicalPrecedent: "Ever Given 2021 (6 days, $9.6B/day trade disruption). Houthi attacks 2023-24 diverted 90%+ of container traffic to Cape route",
    effects: {
      energy: { pressure: 2, mechanism: "Oil and LNG rerouted around Cape of Good Hope (+10-14 days). Shipping costs spike. European energy prices hit hardest" },
      softs: { pressure: 2, mechanism: "Container shipping rates explode (5-10x in Houthi scenario). Coffee, cocoa, rubber, cotton shipping all disrupted" },
      grains: { pressure: 1, mechanism: "Some grain flows affected but most grain trade uses bulk carriers on different routes. Indirect via transport costs" },
      metals_base: { pressure: -1, mechanism: "Shipping delays for Asian metals exports to Europe. Aluminum, zinc, copper delivery schedules disrupted" },
      metals_precious: { pressure: 1, mechanism: "Modest risk premium. Less severe than Hormuz/Malacca for gold" },
      metals_critical: { pressure: -1, mechanism: "Battery metals supply chains from Asia to Europe delayed. Adds cost, not catastrophic" },
      currencies: { pressure: 0, mechanism: "Modest effect. Egypt loses canal revenue. Shipping nations affected. Less systemic than other scenarios" },
      livestock: { pressure: 0, mechanism: "Minimal direct impact. Some feed shipment delays" },
      crypto: { pressure: 0, mechanism: "Not significant enough to drive safe haven flows" },
      rates: { pressure: 0, mechanism: "Inflationary via shipping costs but not enough to change central bank calculus alone" },
    }
  },
  taiwan: {
    label: "Taiwan Strait Crisis",
    region: "East Asia",
    lat: 24.0, lon: 120.5,
    description: "Taiwan produces ~60% of advanced semiconductors (TSMC alone: ~90% of cutting-edge chips). A blockade or invasion would be the most economically devastating geopolitical event since WWII. Every modern commodity requires chips somewhere in its supply chain.",
    flowVolume: "~60% of global semiconductors, $190B+ in chip exports",
    keyPlayers: ["China", "Taiwan", "USA", "Japan", "South Korea"],
    historicalPrecedent: "1995-96 Taiwan Strait crisis. 2022 Pelosi visit triggered military exercises. No kinetic conflict yet",
    effects: {
      metals_critical: { pressure: -3, mechanism: "Semiconductor manufacturing halts \u2192 EV production stops globally. Rare earth supply (China controls 70%+ processing) weaponized. Complete battery/electronics paralysis" },
      metals_base: { pressure: -3, mechanism: "China sanctions/blockade disrupts global manufacturing. Copper demand collapses on industrial shutdown fears. Steel, aluminum trade frozen" },
      energy: { pressure: 2, mechanism: "Oil spikes on general risk. But demand destruction from economic collapse partially offsets. LNG to Asia disrupted" },
      metals_precious: { pressure: 3, mechanism: "Maximum safe haven. Gold potentially +20-30%. Central banks already front-running this risk with gold accumulation" },
      crypto: { pressure: 2, mechanism: "SWIFT weaponization (Russia precedent) drives both Chinese and Western capital toward BTC. But extreme risk-off could dominate initially" },
      currencies: { pressure: 3, mechanism: "USD surges as global safe haven. CNY collapses or gets capital-controlled. AUD crashes. JPY volatile (safe haven vs proximity risk)" },
      grains: { pressure: 1, mechanism: "China is world\u2019s largest grain importer. Trade disruption hits soybean/corn flows. But if China blockades, it hurts itself on food" },
      softs: { pressure: 1, mechanism: "Global trade disruption. Container shipping freezes in Pacific. Rubber, cotton supply chains broken" },
      livestock: { pressure: -1, mechanism: "Chinese pork demand (50% of global) disrupted. Feed trade interrupted. US producers lose export market" },
      rates: { pressure: 2, mechanism: "Global depression risk. Treasuries rally massively (safe haven) despite inflation from supply destruction. Fed forced to ease regardless of inflation" },
    }
  },
  panama: {
    label: "Panama Canal Drought/Restriction",
    region: "Central America",
    lat: 9.1, lon: -79.7,
    description: "Climate-driven low water levels have already restricted daily transits from ~38 to ~24 in 2023-24. This is a slow-burn chokepoint \u2014 not sudden like a military blockade, but structurally degrading over time as climate patterns shift.",
    flowVolume: "~5% of global trade, ~40% of US container traffic, major LNG route",
    keyPlayers: ["Panama", "USA (largest user)", "China (2nd largest user)", "Climate"],
    historicalPrecedent: "2023-24 drought restrictions. El Ni\u00f1o/La Ni\u00f1a cycles directly affect water levels",
    effects: {
      energy: { pressure: 1, mechanism: "US LNG exports to Asia rerouted. Longer voyages = more fuel consumed = ships themselves demand more energy. Shipping rates up" },
      grains: { pressure: 2, mechanism: "US grain exports to Asia heavily use Panama route. Soybean, corn shipments delayed or rerouted via Suez (more expensive). US farmer basis widens" },
      softs: { pressure: 1, mechanism: "Container traffic delays. Coffee from Central/South America, fruit shipments affected" },
      metals_base: { pressure: -1, mechanism: "Chilean/Peruvian copper exports to Atlantic markets delayed. Modest supply chain friction" },
      metals_precious: { pressure: 0, mechanism: "Not severe enough for safe haven flows" },
      metals_critical: { pressure: -1, mechanism: "Lithium from Chile (brine operations) shipping delays to Asian processors" },
      currencies: { pressure: 0, mechanism: "Negligible macro FX impact. Panama\u2019s economy affected locally" },
      livestock: { pressure: -1, mechanism: "Feed grain shipping costs rise. Modest margin pressure for US producers" },
      crypto: { pressure: 0, mechanism: "No meaningful transmission" },
      rates: { pressure: 0, mechanism: "Inflationary at margins but not enough to move central bank policy" },
    }
  },
  rare_earth: {
    label: "China Rare Earth Export Ban",
    region: "East Asia",
    lat: 35.0, lon: 105.0,
    description: "China controls ~60% of rare earth mining and ~90% of processing. A full export ban would paralyze defense, electronics, EV, and wind turbine manufacturing globally. China briefly restricted exports to Japan in 2010 as political leverage.",
    flowVolume: "~90% of global rare earth processing, ~70% of lithium refining, ~80% of cobalt refining",
    keyPlayers: ["China", "USA", "EU", "Japan", "Australia (alternative mining)"],
    historicalPrecedent: "2010 China-Japan rare earth embargo. 2023 gallium/germanium export controls. Escalating pattern",
    effects: {
      metals_critical: { pressure: 3, mechanism: "Direct hit. Rare earths, lithium, cobalt processing all China-dominated. Defense, EV, electronics supply chains break. Prices spike 200-500%+" },
      metals_base: { pressure: 1, mechanism: "Aluminum (China is #1 producer) potentially included. Nickel processing disrupted. Alternative supply sources years away" },
      energy: { pressure: 1, mechanism: "Wind turbine production halts (neodymium magnets). EV production stops. Paradoxically increases near-term fossil fuel dependency" },
      metals_precious: { pressure: 2, mechanism: "Geopolitical escalation premium. Platinum/palladium (catalysts) get caught up if China retaliates broadly" },
      crypto: { pressure: 1, mechanism: "Mild safe haven. ASIC chip supply for BTC mining potentially affected if semiconductor supply chains break" },
      currencies: { pressure: 1, mechanism: "USD strengthens. CNY weaponized. AUD benefits (alternative rare earth mining). BRL/CLP benefit (lithium alternatives)" },
      grains: { pressure: 0, mechanism: "Fertilizer supply not directly affected (that\u2019s natural gas + potash, not rare earths)" },
      softs: { pressure: 0, mechanism: "No meaningful transmission" },
      livestock: { pressure: 0, mechanism: "No meaningful transmission" },
      rates: { pressure: 1, mechanism: "Stagflation risk. Technology sector recession while defense spending surges. Complex macro picture" },
    }
  },
};

// Simple equirectangular world map path (simplified continents)
const WORLD_MAP_PATHS = [
  "M 80 95 L 85 80 L 100 75 L 120 72 L 145 70 L 160 75 L 168 85 L 170 95 L 168 105 L 172 115 L 170 125 L 165 130 L 155 128 L 148 132 L 140 130 L 135 135 L 128 140 L 122 148 L 118 145 L 112 148 L 108 155 L 104 152 L 100 148 L 95 140 L 88 130 L 82 120 L 78 110 L 76 100 Z",
  "M 148 172 L 155 168 L 165 165 L 172 170 L 178 180 L 182 195 L 180 210 L 178 225 L 175 240 L 170 255 L 165 265 L 158 272 L 150 268 L 145 255 L 140 240 L 138 225 L 140 210 L 142 195 L 145 182 Z",
  "M 248 72 L 255 68 L 268 66 L 280 68 L 288 72 L 295 78 L 290 82 L 285 88 L 280 92 L 275 95 L 270 98 L 262 96 L 255 92 L 250 88 L 245 82 L 246 76 Z",
  "M 248 110 L 258 108 L 270 108 L 280 112 L 290 118 L 295 128 L 298 140 L 300 155 L 298 170 L 292 185 L 285 195 L 278 200 L 270 198 L 262 192 L 255 182 L 250 170 L 248 155 L 245 140 L 242 128 L 244 118 Z",
  "M 290 62 L 310 58 L 330 55 L 350 54 L 370 56 L 390 58 L 405 62 L 415 68 L 420 78 L 418 88 L 415 95 L 410 100 L 405 108 L 395 112 L 385 115 L 375 118 L 365 120 L 355 118 L 345 115 L 335 112 L 325 108 L 318 102 L 312 95 L 305 88 L 298 82 L 292 75 L 288 68 Z",
  "M 340 115 L 348 112 L 358 115 L 362 122 L 358 132 L 352 140 L 345 145 L 338 140 L 335 132 L 335 122 Z",
  "M 385 185 L 400 180 L 415 182 L 425 188 L 428 198 L 425 208 L 418 215 L 408 218 L 395 215 L 388 208 L 385 198 Z",
];

const LAYOUT_POSITIONS = {
  energy: { x: 0.5, y: 0.18 },
  metals_precious: { x: 0.22, y: 0.32 },
  metals_base: { x: 0.78, y: 0.32 },
  metals_critical: { x: 0.88, y: 0.55 },
  grains: { x: 0.5, y: 0.48 },
  softs: { x: 0.72, y: 0.72 },
  livestock: { x: 0.38, y: 0.72 },
  currencies: { x: 0.12, y: 0.55 },
  rates: { x: 0.15, y: 0.78 },
  crypto: { x: 0.5, y: 0.88 },
};

/* ═══════════════════════ COMPONENTS ═══════════════════════ */

const PressureBar = ({ value }) => {
  const absVal = Math.abs(value);
  const isPositive = value > 0;
  const barWidth = (absVal / 3) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
      <div style={{ width: 30, textAlign: "right", fontSize: 9, color: isPositive ? "#4ADE80" : value < 0 ? "#F87171" : "#6B7280", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
        {value > 0 ? "+" : ""}{value === 0 ? "~0" : value}
      </div>
      <div style={{ flex: 1, height: 6, background: "#1A1D23", borderRadius: 3, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: isPositive ? "50%" : `${50 - barWidth/2}%`, width: `${barWidth/2}%`, height: "100%", background: isPositive ? "#4ADE80" : "#F87171", borderRadius: 3, opacity: 0.8, transition: "all 0.5s ease" }} />
        <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#3B3F46" }} />
      </div>
    </div>
  );
};

/* ═══════════════════════ GEO MAP COMPONENT ═══════════════════════ */

function GeoMap({ selectedScenario, onSelectScenario }) {
  const [hoveredScenario, setHoveredScenario] = useState(null);
  const mapW = 500, mapH = 300;

  const lonToX = (lon) => ((lon + 180) / 360) * mapW;
  const latToY = (lat) => ((90 - lat) / 180) * mapH;

  const scenarioData = selectedScenario ? GEO_SCENARIOS[selectedScenario] : null;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 auto", minWidth: 400 }}>
        <svg width="100%" viewBox={`0 0 ${mapW} ${mapH}`} style={{ display: "block", background: "#0A0C0F", borderRadius: 6 }}>
          <defs>
            <filter id="geoGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <radialGradient id="pulseGrad" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#E8532E" stopOpacity="0.6" /><stop offset="100%" stopColor="#E8532E" stopOpacity="0" /></radialGradient>
          </defs>
          {[...Array(7)].map((_, i) => <line key={`h${i}`} x1={0} y1={(i+1)*mapH/8} x2={mapW} y2={(i+1)*mapH/8} stroke="#1A1D23" strokeWidth="0.5" />)}
          {[...Array(11)].map((_, i) => <line key={`v${i}`} x1={(i+1)*mapW/12} y1={0} x2={(i+1)*mapW/12} y2={mapH} stroke="#1A1D23" strokeWidth="0.5" />)}
          {WORLD_MAP_PATHS.map((d, i) => <path key={i} d={d} fill="#1E2228" stroke="#2A2D33" strokeWidth="0.5" />)}
          {Object.entries(GEO_SCENARIOS).map(([key, sc]) => {
            const x = lonToX(sc.lon), y = latToY(sc.lat);
            const isActive = selectedScenario === key, isHov = hoveredScenario === key;
            return (
              <g key={key} onClick={() => onSelectScenario(selectedScenario === key ? null : key)} onMouseEnter={() => setHoveredScenario(key)} onMouseLeave={() => setHoveredScenario(null)} style={{ cursor: "pointer" }}>
                {isActive && <circle cx={x} cy={y} r={18} fill="url(#pulseGrad)" opacity={0.6}><animate attributeName="r" values="12;22;12" dur="2s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" /></circle>}
                <circle cx={x} cy={y} r={isActive ? 6 : isHov ? 5 : 4} fill={isActive ? "#E8532E" : isHov ? "#F0C75E" : "#E8532E"} stroke="#0C0E11" strokeWidth={1.5} filter={isActive || isHov ? "url(#geoGlow)" : "none"} style={{ transition: "all 0.3s" }} />
                <text x={x} y={y - 10} textAnchor="middle" fill={isActive ? "#E8EAED" : "#9CA3AF"} fontSize={6} fontWeight="600" fontFamily="'DM Sans', sans-serif" style={{ pointerEvents: "none" }}>{sc.region}</text>
              </g>
            );
          })}
        </svg>
        <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
          {Object.entries(GEO_SCENARIOS).map(([key, sc]) => (
            <button key={key} onClick={() => onSelectScenario(selectedScenario === key ? null : key)} style={{ background: selectedScenario === key ? "#1E2228" : "#12151A", border: selectedScenario === key ? "1px solid #E8532E" : "1px solid #1E2228", color: selectedScenario === key ? "#E8EAED" : "#6B7280", padding: "4px 8px", borderRadius: 4, fontSize: 9, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, transition: "all 0.2s" }}>{sc.label}</button>
          ))}
        </div>
      </div>
      <div style={{ width: 300, flexShrink: 0 }}>
        {scenarioData ? (
          <div>
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "#E8EAED", margin: "0 0 4px 0" }}>{scenarioData.label}</h3>
            <p style={{ fontSize: 10, color: "#9CA3AF", lineHeight: 1.6, margin: "0 0 10px 0", fontFamily: "'DM Sans', sans-serif" }}>{scenarioData.description}</p>
            <div style={{ background: "#1A1D23", borderRadius: 4, padding: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 8, color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Flow Volume</div>
              <div style={{ fontSize: 9, color: "#E8EAED", fontFamily: "'JetBrains Mono', monospace" }}>{scenarioData.flowVolume}</div>
            </div>
            <div style={{ background: "#1A1D23", borderRadius: 4, padding: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 8, color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Key Players</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{scenarioData.keyPlayers.map((p, i) => <span key={i} style={{ background: "#E8532E15", border: "1px solid #E8532E30", color: "#E8532E", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>{p}</span>)}</div>
            </div>
            <div style={{ background: "#1A1D23", borderRadius: 4, padding: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 8, color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Historical Precedent</div>
              <div style={{ fontSize: 9, color: "#9CA3AF", lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{scenarioData.historicalPrecedent}</div>
            </div>
            <div style={{ fontSize: 8, color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, fontWeight: 500 }}>Commodity Impact</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {Object.entries(scenarioData.effects).sort((a, b) => Math.abs(b[1].pressure) - Math.abs(a[1].pressure)).map(([catKey, eff]) => {
                const cat = CATEGORIES[catKey];
                return (
                  <div key={catKey} style={{ background: "#0C0E11", borderRadius: 4, padding: "6px 8px", borderLeft: `2px solid ${cat.color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}><span style={{ fontSize: 10, fontWeight: 600, color: cat.color, fontFamily: "'DM Sans', sans-serif" }}>{cat.label}</span></div>
                    <PressureBar value={eff.pressure} />
                    <div style={{ fontSize: 8, color: "#9CA3AF", marginTop: 4, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{eff.mechanism}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 9, color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12, fontWeight: 500 }}>Chokepoints</div>
            <p style={{ fontSize: 10, color: "#9CA3AF", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif", margin: "0 0 16px 0" }}>Select a scenario on the map or from the buttons below. Each shows how a specific geopolitical disruption cascades through commodity markets.</p>
            <p style={{ fontSize: 10, color: "#9CA3AF", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif", margin: "0 0 16px 0" }}>Unlike Fed policy (which changes the financial plumbing), geopolitical shocks hit the physical supply layer directly. Energy and grains are most exposed because they transit through physical chokepoints. Precious metals respond as safe havens. Industrial metals get hit by both supply disruption and demand destruction.</p>
            <div style={{ background: "#1A1D23", borderRadius: 6, padding: 12, borderLeft: "2px solid #E8532E" }}>
              <div style={{ fontSize: 10, color: "#E8532E", fontWeight: 500, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>Key insight</div>
              <p style={{ fontSize: 10, color: "#9CA3AF", lineHeight: 1.5, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>Macro regime shocks (Fed tab) change the cost of money. Geopolitical shocks change the availability of stuff. Both move commodity prices, but through completely different pipes. The most dangerous moments are when both hit simultaneously \u2014 e.g., an energy supply shock during a tightening cycle creates stagflation, the scenario central banks fear most.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */

function CommodityMap() {
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [regime, setRegime] = useState(null);
  const [geoScenario, setGeoScenario] = useState(null);
  const [tab, setTab] = useState("linkage");
  const [macroView, setMacroView] = useState("map");
  const [dims, setDims] = useState({ w: 820, h: 580 });

  useEffect(() => {
    const handleResize = () => {
      const w = Math.min(window.innerWidth - 48, 860);
      const h = Math.max(480, Math.min(window.innerHeight - 300, 620));
      setDims({ w, h });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const nodes = useMemo(() => Object.entries(CATEGORIES).map(([key, cat]) => ({
    id: key, label: cat.label, color: cat.color,
    x: LAYOUT_POSITIONS[key].x * dims.w, y: LAYOUT_POSITIONS[key].y * dims.h,
    items: cat.items, description: cat.description,
  })), [dims]);

  const activeConnections = useMemo(() => {
    if (!selected && !hovered) return CONNECTIONS;
    const active = selected || hovered;
    return CONNECTIONS.filter(c => c.from === active || c.to === active);
  }, [selected, hovered]);

  const getNodeById = useCallback((id) => nodes.find(n => n.id === id), [nodes]);
  const handleNodeClick = useCallback((id) => setSelected(prev => prev === id ? null : id), []);
  const isNodeActive = useCallback((id) => {
    if (!selected && !hovered) return true;
    const active = selected || hovered;
    if (id === active) return true;
    return activeConnections.some(c => c.from === id || c.to === id);
  }, [selected, hovered, activeConnections]);

  const selectedData = selected ? CATEGORIES[selected] : null;
  const regimeData = regime ? MACRO_REGIMES[regime] : null;
  const getPC = useCallback((id) => { if (!regimeData) return null; const e = regimeData.effects[id]; return e ? (e.pressure > 0 ? "#4ADE80" : e.pressure < 0 ? "#F87171" : "#6B7280") : null; }, [regimeData]);
  const getPS = useCallback((id) => { if (!regimeData) return 0; const e = regimeData.effects[id]; return e ? Math.abs(e.pressure) : 0; }, [regimeData]);

  return (
    <div style={{ background: "#0C0E11", minHeight: "100vh", fontFamily: "'JetBrains Mono', monospace", color: "#C8CCD0", padding: "16px", boxSizing: "border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: "#E8EAED", margin: 0, letterSpacing: "-0.5px" }}>COMMODITY INTERLINKAGE MAP</h1>
          <div style={{ display: "flex", gap: 2, marginTop: 8, borderBottom: "1px solid #1E2228", paddingBottom: 0 }}>
            {[{ id: "linkage", label: "Linkage Graph" }, { id: "macro", label: "Macro Pressure" }, { id: "geo", label: "Geopolitical Chokepoints" }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? "#12151A" : "transparent", border: tab === t.id ? "1px solid #1E2228" : "1px solid transparent", borderBottom: tab === t.id ? "1px solid #12151A" : "1px solid transparent", color: tab === t.id ? "#E8EAED" : "#6B7280", padding: "8px 16px", borderRadius: "6px 6px 0 0", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, marginBottom: -1, transition: "all 0.2s" }}>{t.label}</button>
            ))}
          </div>
        </div>

        {tab === "linkage" && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 auto", minWidth: 480, background: "#12151A", borderRadius: 8, border: "1px solid #1E2228" }}>
              <svg width={dims.w} height={dims.h} viewBox={`0 0 ${dims.w} ${dims.h}`} style={{ display: "block" }}>
                <defs>
                  <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  {Object.entries(CATEGORIES).map(([k, c]) => <radialGradient key={k} id={`grad-${k}`} cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={c.color} stopOpacity="0.25" /><stop offset="100%" stopColor={c.color} stopOpacity="0.05" /></radialGradient>)}
                </defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1A1D23" strokeWidth="0.5" /></pattern>
                <rect width={dims.w} height={dims.h} fill="url(#grid)" />
                {CONNECTIONS.map((conn, i) => {
                  const from = getNodeById(conn.from), to = getNodeById(conn.to);
                  if (!from || !to) return null;
                  const isAct = activeConnections.includes(conn), act = selected || hovered;
                  const opacity = act ? (isAct ? 0.7 : 0.04) : 0.15;
                  const sw = conn.strength * (isAct && act ? 1.8 : 1);
                  const mx = (from.x+to.x)/2, my = (from.y+to.y)/2, dx = to.x-from.x, dy = to.y-from.y;
                  const dist = Math.sqrt(dx*dx+dy*dy);
                  const ox = dist>0 ? -(dy/dist)*(dist*0.08) : 0, oy = dist>0 ? (dx/dist)*(dist*0.08) : 0;
                  return (<g key={i}><defs><linearGradient id={`l-${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor={CATEGORIES[conn.from].color}/><stop offset="100%" stopColor={CATEGORIES[conn.to].color}/></linearGradient></defs><path d={`M ${from.x} ${from.y} Q ${mx+ox} ${my+oy} ${to.x} ${to.y}`} fill="none" stroke={`url(#l-${i})`} strokeWidth={sw} opacity={opacity} style={{transition:"opacity 0.3s"}}/>{isAct&&act&&<text x={mx+ox} y={my+oy-6} textAnchor="middle" fill="#9CA3AF" fontSize={9} fontFamily="'JetBrains Mono', monospace" opacity={0.85} style={{pointerEvents:"none"}}>{conn.label}</text>}</g>);
                })}
                {nodes.map(node => {
                  const active = isNodeActive(node.id), isSel = selected===node.id, isHov = hovered===node.id;
                  const r = isSel ? 38 : isHov ? 34 : 30;
                  return (<g key={node.id} onClick={()=>handleNodeClick(node.id)} onMouseEnter={()=>setHovered(node.id)} onMouseLeave={()=>setHovered(null)} style={{cursor:"pointer"}} opacity={active?1:0.2}>
                    <circle cx={node.x} cy={node.y} r={r+12} fill={`url(#grad-${node.id})`}/>
                    <circle cx={node.x} cy={node.y} r={r} fill="#12151A" stroke={node.color} strokeWidth={isSel?2.5:1.5} filter={isSel||isHov?"url(#glow)":"none"}/>
                    <text x={node.x} y={node.y-3} textAnchor="middle" dominantBaseline="middle" fill={node.color} fontSize={10} fontWeight="700" fontFamily="'DM Sans', sans-serif" style={{pointerEvents:"none"}}>{node.label.length>14?node.label.split(/[\s/]/).map((w,wi,arr)=><tspan key={wi} x={node.x} dy={wi===0?-(arr.length-1)*6:13}>{w}</tspan>):node.label}</text>
                    <text x={node.x} y={node.y+14} textAnchor="middle" fill="#6B7280" fontSize={8} fontFamily="'JetBrains Mono', monospace" style={{pointerEvents:"none"}}>{node.items.length} instruments</text>
                  </g>);
                })}
              </svg>
            </div>
            <div style={{ width: 280, flexShrink: 0, background: "#12151A", borderRadius: 8, border: "1px solid #1E2228", padding: 16, maxHeight: dims.h, overflowY: "auto" }}>
              {selectedData ? (<>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><div style={{width:10,height:10,borderRadius:"50%",background:CATEGORIES[selected].color}}/><h2 style={{fontFamily:"'DM Sans', sans-serif",fontSize:15,fontWeight:700,color:"#E8EAED",margin:0}}>{selectedData.label}</h2></div>
                <p style={{fontSize:11,lineHeight:1.6,color:"#9CA3AF",margin:"0 0 16px 0",fontFamily:"'DM Sans', sans-serif"}}>{selectedData.description}</p>
                <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase",letterSpacing:"1px",marginBottom:8,fontWeight:500}}>Instruments</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:16}}>{selectedData.items.map((item,i)=><span key={i} style={{background:`${CATEGORIES[selected].color}15`,border:`1px solid ${CATEGORIES[selected].color}30`,color:CATEGORIES[selected].color,padding:"3px 8px",borderRadius:4,fontSize:10,fontFamily:"'JetBrains Mono', monospace"}}>{item}</span>)}</div>
                <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase",letterSpacing:"1px",marginBottom:8,fontWeight:500}}>Connections ({activeConnections.length})</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>{activeConnections.map((conn,i)=>{const other=conn.from===selected?conn.to:conn.from;const oc=CATEGORIES[other];return(<div key={i} style={{background:"#1A1D23",borderRadius:4,padding:"6px 8px",borderLeft:`2px solid ${oc.color}`}}><div style={{fontSize:10,fontWeight:500,color:oc.color,fontFamily:"'DM Sans', sans-serif"}}>{conn.from===selected?"\u2192":"\u2190"} {oc.label}</div><div style={{fontSize:9,color:"#6B7280",marginTop:2,fontFamily:"'JetBrains Mono', monospace"}}>{conn.label}</div></div>);})}</div>
              </>) : (
                <div>
                  <div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase",letterSpacing:"1px",marginBottom:12,fontWeight:500}}>Legend</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>{Object.entries(CATEGORIES).map(([k,c])=><div key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"4px 6px",borderRadius:4,background:hovered===k?"#1A1D23":"transparent"}} onClick={()=>handleNodeClick(k)} onMouseEnter={()=>setHovered(k)} onMouseLeave={()=>setHovered(null)}><div style={{width:8,height:8,borderRadius:"50%",background:c.color}}/><span style={{fontSize:11,color:"#C8CCD0",fontFamily:"'DM Sans', sans-serif"}}>{c.label}</span><span style={{fontSize:9,color:"#4B5563",marginLeft:"auto",fontFamily:"'JetBrains Mono', monospace"}}>{c.items.length}</span></div>)}</div>
                  <div style={{background:"#1A1D23",borderRadius:6,padding:12,borderLeft:"2px solid #F0C75E"}}><div style={{fontSize:10,color:"#F0C75E",fontWeight:500,marginBottom:4,fontFamily:"'DM Sans', sans-serif"}}>Key insight</div><p style={{fontSize:10,color:"#9CA3AF",lineHeight:1.5,margin:0,fontFamily:"'DM Sans', sans-serif"}}>Energy sits at the top because it's an input to everything. The USD is the denominator of nearly all commodity pricing. These two form the "trinity" with monetary policy that drives all commodity markets.</p></div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "macro" && (
          <div>
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
              {Object.entries(MACRO_REGIMES).map(([k,r])=><button key={k} onClick={()=>setRegime(prev=>prev===k?null:k)} style={{background:regime===k?"#1E2228":"#12151A",border:regime===k?"1px solid #3B82F6":"1px solid #1E2228",color:regime===k?"#E8EAED":"#9CA3AF",padding:"6px 12px",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:"'DM Sans', sans-serif",fontWeight:500,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:14}}>{r.icon}</span>{r.label}</button>)}
            </div>
            {regimeData && <div style={{background:"#12151A",border:"1px solid #1E2228",borderRadius:8,padding:"10px 14px",marginBottom:12}}><div style={{fontSize:11,color:"#3B82F6",fontWeight:600,fontFamily:"'DM Sans', sans-serif",marginBottom:2}}>{regimeData.subtitle}</div><div style={{fontSize:10,color:"#9CA3AF",lineHeight:1.5,fontFamily:"'DM Sans', sans-serif"}}>{regimeData.description}</div></div>}
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:"1 1 auto",minWidth:480,background:"#12151A",borderRadius:8,border:"1px solid #1E2228",overflow:"hidden"}}>
                {macroView==="map" ? (
                  <svg width={dims.w} height={dims.h} viewBox={`0 0 ${dims.w} ${dims.h}`} style={{display:"block"}}>
                    <defs>
                      <filter id="glow2"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                      <filter id="pGlow"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                      {Object.entries(CATEGORIES).map(([k,c])=><radialGradient key={k} id={`mg-${k}`} cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={c.color} stopOpacity="0.25"/><stop offset="100%" stopColor={c.color} stopOpacity="0.05"/></radialGradient>)}
                    </defs>
                    <pattern id="mgrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1A1D23" strokeWidth="0.5"/></pattern>
                    <rect width={dims.w} height={dims.h} fill="url(#mgrid)"/>
                    {CONNECTIONS.map((conn,i)=>{const from=getNodeById(conn.from),to=getNodeById(conn.to);if(!from||!to)return null;const mx=(from.x+to.x)/2,my=(from.y+to.y)/2,dx=to.x-from.x,dy=to.y-from.y,dist=Math.sqrt(dx*dx+dy*dy),ox=dist>0?-(dy/dist)*(dist*0.08):0,oy=dist>0?(dx/dist)*(dist*0.08):0;return <g key={i}><defs><linearGradient id={`ml-${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor={CATEGORIES[conn.from].color}/><stop offset="100%" stopColor={CATEGORIES[conn.to].color}/></linearGradient></defs><path d={`M ${from.x} ${from.y} Q ${mx+ox} ${my+oy} ${to.x} ${to.y}`} fill="none" stroke={`url(#ml-${i})`} strokeWidth={conn.strength} opacity={0.12}/></g>;})}
                    {nodes.map(node=>{const r=30;const pc=getPC(node.id);const ps=getPS(node.id);return(<g key={node.id} style={{cursor:"pointer"}}><circle cx={node.x} cy={node.y} r={r+12} fill={`url(#mg-${node.id})`}/>{regime&&pc&&<circle cx={node.x} cy={node.y} r={r+10+ps*5} fill="none" stroke={pc} strokeWidth={1.5} opacity={0.4} filter="url(#pGlow)" style={{transition:"all 0.5s"}}/>}<circle cx={node.x} cy={node.y} r={r} fill="#12151A" stroke={regime&&pc?pc:node.color} strokeWidth={1.5} style={{transition:"all 0.3s"}}/><text x={node.x} y={node.y-3} textAnchor="middle" dominantBaseline="middle" fill={regime&&pc?pc:node.color} fontSize={10} fontWeight="700" fontFamily="'DM Sans', sans-serif" style={{pointerEvents:"none"}}>{node.label.length>14?node.label.split(/[\s/]/).map((w,wi,arr)=><tspan key={wi} x={node.x} dy={wi===0?-(arr.length-1)*6:13}>{w}</tspan>):node.label}</text>{regime&&regimeData.effects[node.id]?<text x={node.x} y={node.y+14} textAnchor="middle" fill={pc} fontSize={10} fontWeight="700" fontFamily="'JetBrains Mono', monospace" style={{pointerEvents:"none"}}>{regimeData.effects[node.id].pressure>0?"+":""}{regimeData.effects[node.id].pressure===0?"~0":regimeData.effects[node.id].pressure}</text>:<text x={node.x} y={node.y+14} textAnchor="middle" fill="#6B7280" fontSize={8} fontFamily="'JetBrains Mono', monospace" style={{pointerEvents:"none"}}>{node.items.length}</text>}</g>);})}
                  </svg>
                ) : (
                  <div style={{padding:16}}>{regime?<div style={{display:"flex",flexDirection:"column",gap:8}}>{Object.entries(regimeData.effects).sort((a,b)=>a[1].lag-b[1].lag||Math.abs(b[1].pressure)-Math.abs(a[1].pressure)).map(([ck,eff])=>{const cat=CATEGORIES[ck];return(<div key={ck} style={{background:"#1A1D23",borderRadius:6,padding:"10px 12px",borderLeft:`3px solid ${cat.color}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:12,fontWeight:600,color:cat.color,fontFamily:"'DM Sans', sans-serif"}}>{cat.label}</span><span style={{fontSize:8,color:"#6B7280"}}>{eff.lag===1?"immediate":eff.lag===2?"weeks":"months"}</span></div><PressureBar value={eff.pressure}/><div style={{fontSize:9,color:"#9CA3AF",marginTop:6,lineHeight:1.5,fontFamily:"'DM Sans', sans-serif"}}>{eff.mechanism}</div></div>);})}</div>:<div style={{textAlign:"center",padding:"80px 20px",color:"#4B5563",fontSize:12}}>Select a scenario above</div>}</div>
                )}
              </div>
              <div style={{ width: 280, flexShrink: 0, background: "#12151A", borderRadius: 8, border: "1px solid #1E2228", padding: 16 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                  {["map","pressure"].map(v=><button key={v} onClick={()=>setMacroView(v)} style={{background:macroView===v?"#1E2228":"transparent",border:"1px solid #2A2D33",color:macroView===v?"#E8EAED":"#6B7280",padding:"3px 10px",borderRadius:4,fontSize:9,cursor:"pointer",fontFamily:"'JetBrains Mono', monospace"}}>{v==="map"?"Graph":"List"}</button>)}
                </div>
                {regime ? (
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>{Object.entries(regimeData.effects).sort((a,b)=>b[1].pressure-a[1].pressure).map(([ck,eff])=>{const cat=CATEGORIES[ck];return(<div key={ck} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 6px"}}><div style={{width:6,height:6,borderRadius:"50%",background:cat.color}}/><span style={{fontSize:9,color:"#C8CCD0",fontFamily:"'DM Sans', sans-serif",flex:1}}>{cat.label}</span><span style={{fontSize:9,fontWeight:600,fontFamily:"'JetBrains Mono', monospace",color:eff.pressure>0?"#4ADE80":eff.pressure<0?"#F87171":"#6B7280"}}>{eff.pressure>0?"+":""}{eff.pressure===0?"~0":eff.pressure}</span></div>);})}</div>
                ) : (
                  <div style={{background:"#1A1D23",borderRadius:6,padding:12,borderLeft:"2px solid #3B82F6"}}><div style={{fontSize:10,color:"#3B82F6",fontWeight:500,marginBottom:4,fontFamily:"'DM Sans', sans-serif"}}>Valley analogy</div><p style={{fontSize:10,color:"#9CA3AF",lineHeight:1.5,margin:0,fontFamily:"'DM Sans', sans-serif"}}>The Fed is the dam operator. Select a scenario to see how each action sends pressure through the commodity system \u2014 which pipes open, which constrict, and how fast the pressure arrives.</p></div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "geo" && (
          <div style={{ background: "#12151A", borderRadius: 8, border: "1px solid #1E2228", padding: 16 }}>
            <GeoMap selectedScenario={geoScenario} onSelectScenario={setGeoScenario} />
          </div>
        )}

        <div style={{ marginTop: 12, padding: 12, background: "#12151A", borderRadius: 8, border: "1px solid #1E2228", fontSize: 10, color: "#6B7280", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
          <span style={{ color: "#9CA3AF", fontWeight: 500 }}>v3.0 \u2014 Three-layer model.</span>{" "}
          Linkage graph (structural) &middot; Macro pressure (financial plumbing) &middot; Geopolitical chokepoints (physical supply)
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<CommodityMap />);
