/* Smokeline · Coil & Chiller · where every relation and number comes from, and how far it is verified.
   English summary of kaynak_tablosu.m / KAYNAK_DOGRULAMA.md (matlab_v2, 14 Nov 2026). Status:
   ok = checked against the source · part = partly checked (secondary source or form only) · no = could not be checked
   · conflict = sources disagree · tb = textbook form, primary source not opened · est = project estimate (no source)
   · rule = rule of thumb, not a literature value · site = earlier project result */
(function(root){
'use strict';
root.HXSources=[
 [1,'Tube side, laminar: Hausen thermal entry, Nu = 3.66 + 0.0668·Gz / (1 + 0.04·Gz<sup>2/3</sup>), Gz = Re·Pr·D/L','part','Dostál et al., EPJ Web Conf. 269 (2022) 01009, Eq. 4; Incropera Eq. 8.57 expected','One published form has 0.045 in the denominator (−3 % on Nu). No source found that the thermal entry restarts after each U-bend, so the page gives a band: L = circuit length (conservative) and L = one pass (optimistic).'],
 [2,'Tube side, turbulent: Gnielinski','part','Afan et al., Nanomaterials 12 (2022) 1545 (secondary); Gnielinski 1976 not accessed','Range 3000 < Re < 5·10<sup>6</sup>, 0.5 < Pr < 2000. The short-tube factor of VDI G1 is not applied (small, conservative).'],
 [3,'Petukhov friction factor f = (0.79 ln Re − 1.64)<sup>−2</sup>','part','Fahim et al., Front. Chem. (2023) Eq. 13 (secondary)','Same coefficients.'],
 [4,'Linear blend for 2300 < Re < 4000','part','Gnielinski, IJHMT 63 (2013) 134–140 (abstract)','Gnielinski holds the laminar end at Re = 2300; the code uses the local Re. That is why the designer rejects candidates in the transition range by default.'],
 [5,'No viscosity-ratio (Sieder–Tate) correction, no mixed convection','est','physical reasoning','The fluid is heated, so leaving the correction out gives a lower Nu: conservative.'],
 [6,'Air side: VDI / Ganguli, Nu = C·Re<sup>0.6</sup>·(A/A<sub>t0</sub>)<sup>−0.15</sup>·Pr<sup>1/3</sup>','part','VDI Heat Atlas M1 (not accessed); Petrik et al., Processes 8 (2020) 773; Aljolani et al., Energies 13 (2020) 2428','C = 0.22 in-line / 0.38 staggered checked. The row corrections and the range were not seen in a primary source. Fitted to individually finned tubes; using it for plate fins is a project assumption.'],
 [7,'Fin efficiency, Schmidt equivalent circular fin','part','Schmidt 1949 (not accessed); Petrik et al. 2020 Eqs. 11–13','The φ form and η = tanh X / X checked; the constants 1.28 / 1.27 not seen.'],
 [8,'Air Δp: Jakob tube bank + fin-channel friction','no','Jakob, Trans. ASME 60 (1938); Holman ch. 6 expected','Cross-check only. Differs by 26 % from the reference curve, so the page also shows the scaled value.'],
 [9,'Fin channel f = 96/Re or 0.316·Re<sup>−0.25</sup>, entry loss 0.5','tb','parallel plates, D<sub>h</sub> = 2 × gap','Entry loss 0.5 is an estimate.'],
 [10,'Reference air Δp 100 Pa at 4.5 m/s, n = 1.8; vendor Δp of the NASA IRT coil about 70 % low','site','curve: earlier site value; IRT: Canacci et al., NASA/CR-2001-210687','The curve only fits the reference geometry.'],
 [11,'Wang, Chi & Chang (2000) plate-fin j and f as a cross-check','no','IJHMT 43 (2000) 2693–2700 (abstract only)','Equation set not seen, not coded. 8 mm fin pitch is probably outside its range.'],
 [12,'ε-NTU, counter-flow and cross-flow (both unmixed)','tb','Incropera Table 11.3','Textbook forms.'],
 [13,'UA = Σ UA<sub>stage</sub>, the two stages in series taken as pure counter-flow','est','Kays & London / ESDU not checked','Cross-flow instead changes the supply temperature by 0.1–0.3 K (shown in the calculation chain).'],
 [14,'Fluid Δp = (f·L/D + K<sub>bend</sub>·n + 1.5)·½ρv², K<sub>bend</sub> = 0.5','part','Idelchik (2006) diagram 6-1','In laminar flow the real bend loss can exceed 0.5; check near the Δp limit.'],
 [15,'Wire-coil turbulator: Nu × 2, f × 1.4, only above Re 600 (off by default)','conflict','García, Vicente & Viedma, IJHMT 48 (2005); García et al., IJHMT 50 (2007) (abstracts)','An earlier f × 2.5 contradicted the source (laminar f rises only 5–40 %).'],
 [16,'Limits: v ≤ 2.5 m/s, fluid Δp ≤ 150 kPa, ≤ 60 circuits, air Δp ≤ 130 Pa, depth ≤ 0.5 m, transition banned','rule','—','Project decisions and rules of thumb, not literature values.'],
 [17,'Pump: 100 kPa outside the coil, η 0.5, all shaft power goes into the fluid','est','—','The pump sits between chiller and coil (conservative).'],
 [18,'Load: K<sub>top</sub> 0.5267 (kapali_devre_1D.m v1.7, S2 at 40 m/s; the matlab_v2 reports used 0.5175 from 50 m/s), η<sub>fan</sub> 0.75, η<sub>motor</sub> 0.91, U 0.298 W/m²K, A 81.73 m², λ<sub>fan</sub> 2; refrigeration margin 1.30 on the iced load (project estimate, as kapali_devre_1D.m v1.8)','conflict','closed-circuit sheet S2; Bansmer et al., AMT 11 (2018) 3221–3249','Braunschweig sized its fan with P<sub>fan</sub>/P<sub>jet</sub> = 2.3, which is not our λ<sub>fan</sub>. Our clean equivalent is about ½–⅓ of theirs, so the load is sensitive to K<sub>top</sub>: see the sensitivity table.'],
 [19,'Water and ice constants c<sub>w</sub> 4183, L<sub>f</sub> 334 000, c<sub>ice</sub> 2050','tb','standard values','c<sub>ice</sub> averages 1.9–2.05 kJ/kgK between −35 and 0 °C.'],
 [20,'Air: Sutherland μ, k = 0.0241·(T/273.15)<sup>0.81</sup>, c<sub>p</sub> 1005','tb','—','About 1 % from tables at −35 °C.'],
 [21,'Cylinder collection efficiency, Finstad','part','Finstad 1986 thesis pp. 14, 37; Fan et al., Energies 11 (2018) 2678','Coefficients the same; tested range 0.07 < E < 0.63 not confirmed.'],
 [22,'Langmuir drag 1 + 0.197·Re<sup>0.63</sup> + 2.6·10<sup>−4</sup>·Re<sup>1.38</sup>; Langmuir-D classes','no','Langmuir & Blodgett (1946) not accessed','Unresolved: one source gives 0.0026 instead of 2.6·10<sup>−4</sup>; it can change the water reaching the coil.'],
 [23,'Droplet paths through a corner passage (free vortex)','est','one-parameter fit to NASA TM-87095 Fig. 15','No independent data; the water reaching the coil rests on it.'],
 [24,'Corner loss K<sub>0</sub> = 0.10 + 4.55/(log<sub>10</sub> Re)<sup>2.58</sup>','no','Barlow, Rae & Pope (1999) ch. 3','Equation number not confirmed.'],
 [25,'Leading-edge horn model c·ρ = 540 kg/m³, n<sub>e</sub> 1.25, b<sub>lim</sub> 0.6; corner m = 2; ρ<sub>ice</sub> 400; k<sub>ice</sub> 0.3','est','fitted to NASA TM-100116 (Olsen, Van Fossen & Nussle 1987)','The ≈ 4 mm horn after 39 min was read from a figure. A hypothesis, not a design value: the front-stage fin pitch rests on it.'],
 [26,'NASA IRT water split (90–47 % in the cooler)','ok','NASA TM-87095','Used as a comparison only.'],
 [28,'HC-50 properties −50…+20 °C, freezing < −55 °C, lowest use −50 °C','ok','Dynalene HC Engineering Guide (2014) Tables 1, 5a; Properties of Dynalene HC (2020)','The often-quoted 14.9 mPa·s at −40 °C is HC-40.'],
 [29,'Dowtherm J properties −80…0 °C, flash 57 °C','ok','Dow Form 176-01465-1101 (2001)',''],
 [30,'Therminol LT properties −73…+20 °C, crystallises −75 °C','ok','Eastman TF-8426A (2020); TF-10871D (2023)',''],
 [31,'Syltherm XLT (Dow table); the CERN 1997 table','conflict','Dow Form 176-01434-298 (1998); CERN Table 01 (1997)','Dow is used. The CERN table disagrees and is never recommended.'],
 [32,'Tyfoxit F50 properties −50…+20 °C, freezing / lowest use −50 °C','ok','TYFOROP TYFOXIT F15–F50 TI (2020)','Column headings ambiguous; matched with ρ·ν = μ.'],
 [33,'CO₂ triple point −56.6 °C; evaporation 4–8 K below the supply','ok','NIST Chemistry WebBook','The 4–8 K difference is a rule of thumb.'],
 [34,'Fin pitches 4/7/10/12 mm, −40 °C limit (Friterm GCS); tube patterns A–D','no','manufacturer catalogue not seen','Ask the manufacturer which dies and pitches it can make.'],
 [35,'Air leaving the coil at total temperature T<sub>0</sub> = T + V²/(2c<sub>p</sub>)','tb','energy equation','The coil sits at the settling-chamber inlet where the air is almost at rest.'],
 [36,'Front-stage fin pitch = t<sub>f</sub> + margin·(dw/dt)·t<sub>run</sub>/b<sub>lim</sub>, margin 1.25','est','horn model (row 25) + safety factor','The margin and the sizing envelope are decisions.']
];
})(typeof self!=='undefined'?self:this);
