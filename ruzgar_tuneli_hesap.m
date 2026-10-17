% =========================================================================
%  RUZGAR TUNELI --- 1D ON HESAP TABLOSU
%  (Ek Toolbox gerekmez | GIRDILER santimetre [cm], hesaplar SI)
%  Versiyon: 5.1  |  Tarih: 2026-10-17
%  Ref: Barlow, Rae & Pope "Low-Speed Wind Tunnel Testing" (1999)
%       Eckert, Mort & Jope (1976), Ek B: difuzor genisleme kaybi K_e
%       (orijinal bagintilar, 2*theta cinsinden)
% =========================================================================
%
%  v5.1 DEGISIKLIKLERI (Bolum 7):
%   - Kare kesit K_e bagintisi Barlow Eq. 3.29 yerine orijinal kaynaktan
%     (Eckert vd. B7-B9) alindi. Barlow'daki yazim hatalari:
%       * theta > 5 derece dogrusal kisim sabit terimi: -0.01322 -> -0.1322
%       * polinom theta^3 katsayisi isareti, theta^5 katsayisi (isaret ve
%         basamak), theta^6 katsayisi isareti hatali.
%     Duzeltilmis bagintilar 3 ve 10 derecede (2*theta) suruklidir.
%   - Kare -> daire gecisli difuzor icin Eckert vd. B14 uygulandi:
%       K_EXP = K_temel + (1 - delta_s) * (K_ek - K_temel)
%     K_temel = (K_kare + K_daire)/2  (3D ortalama),
%     K_ek    = 2D ortalama,  delta_s = duzlemsellik orani.
%   - Difuzor surtunme faktoru Barlow'a uygun olarak test kesitindeki gibi
%     Prandtl (Eq. 3.14) ile, giris Reynolds sayisiyla hesaplanir.
%
%  BOLUMLER:
%   1.  Sabit Girdi Parametreleri (Gercek Tunel Geometrisi)
%   1b. Birim Donusumu cm->m
%   2.  Kullanici Girisleri (Command Window)
%   3.  Girdi Kontrol Mekanizmasi
%   4.  Hava Ozellikleri
%   5.  Test Kesiti Hesaplari
%   6.  Nozzle Geometrisi + Wattendorf K_nozzle
%   7.  Difuzor Kaybi  (Barlow Eq. 3.24-3.27 + Eckert vd. K_e)
%   8.  Cikis Atim Kaybi
%   9.  Dinlenme Odasi Kayiplari (Honeycomb + Ekranlar)
%  10.  Model Suruklenme Kaybi
%  11.  Mach / Kompresibilite
%  12.  Basinc Kaybi Ozet + Fan Guc Tahmini
%  13.  Hiz Duyarlilik Tablosu
%  14.  Grafikler
%  15.  CFD On Hazirlik
%  --   Yerel fonksiyonlar (K_e bagintilari) dosyanin sonunda
% =========================================================================

clear; clc; format shortG;

%% -------------------------------------------------------------------------
%% 1. SABIT GIRDI PARAMETRELERI
%%    Uzunluklar [cm], hiz m/s, sicaklik degC, basinc Pa.
%% -------------------------------------------------------------------------

% --- Test Kesiti [cm] ---
test_w_cm = 20.0;
test_h_cm = 20.0;
test_L_cm = 60.0;

% --- Nozzle (Daralma Konisi) ---
% Giris Kare 50x50, Cikis Kare 20x20
nozzle_in_w_cm    = 50.0;    % Giris genisligi [cm]
nozzle_in_h_cm    = 50.0;    % Giris yuksekligi [cm]
L_nozzle_horiz_cm = 25.0;    % Eksenel daralma uzunlugu [cm]

% --- Difuzor ---
% Giris Kare 20x20, Cikis Dairesel
L_diffuser_cm     = 178.0;   % Difuzor eksenel uzunlugu [cm]
diffuser_out_D_cm = 60.0;    % Cikis dairesel capi [cm]

% --- Dinlenme Odasi / Settling Chamber ---
% Balpetegi (Honeycomb)
Lh_Dh    = 6.0;     % Derinlik/cap orani [-]
beta_h   = 0.80;    % Balpetegi poruzitesi [-]
lambda_h = 0.004;   % Purus cidar katsayisi [-]
% Tel ekranlar (Screens)
N_screens = 2;      % Ekran sayisi [-]
d_w_mm    = 0.2;    % Tel capi [mm]
w_m_mm    = 1.0;    % Mesh genisligi [mm]
K_mesh    = 1.3;    % Mesh kayip carpani [-]

% --- Model ---
%  model_chord_cm -> Bolum 2'de kullanicidan alinir veya otomatik hesaplanir
Cd_model     = 0.04;   % Profil suruklenme katsayisi (NACA 0012 ~ 0.03-0.05) [-]
is_2D_airfoil = true;  % true: duvardan duvara 2D airfoil

% --- Darcy f (test kesiti; NaN -> Prandtl Eq. 3.14 iterasyonu kullanilir) ---
f_Darcy = NaN;

% --- Fan Verimi ---
fan_verimi = 0.75;   % [-]

%% -------------------------------------------------------------------------
%% 1b. BIRIM DONUSUMU: cm -> m
%% -------------------------------------------------------------------------
cm2m = 1e-2;

test_w         = test_w_cm         * cm2m;
test_h         = test_h_cm         * cm2m;
test_L         = test_L_cm         * cm2m;
nozzle_in_w    = nozzle_in_w_cm    * cm2m;
nozzle_in_h    = nozzle_in_h_cm    * cm2m;
L_nozzle_horiz = L_nozzle_horiz_cm * cm2m;
L_diffuser     = L_diffuser_cm     * cm2m;
diffuser_out_D = diffuser_out_D_cm * cm2m;
d_w            = d_w_mm            * 1e-3;   % [m]
w_m            = w_m_mm            * 1e-3;   % [m]

% A_test ve AR_diffuser onceden hesaplanir
A_test = test_w * test_h;
A_diffuser_out = pi * (diffuser_out_D / 2)^2;
AR_diffuser = A_diffuser_out / A_test;

%% -------------------------------------------------------------------------
%% 2. KULLANICI GIRISLERI (Command Window)
%% -------------------------------------------------------------------------

fprintf('\n%s\n', repmat('=',1,60));
fprintf('   RUZGAR TUNELI --- CALISMA SARTI GIRISLERI\n');
fprintf('%s\n', repmat('=',1,60));

V_test = input('  Hedef test hizi          [m/s]  : ');
T_degC = input('  Statik sicaklik          [degC] : ');
P_stat = input('  Statik basinc            [Pa]   : ');

% --- Model Kordu ---
raw_chord = input('  Model kordunu girin [cm] (otomatik icin bos birakin): ', 's');

if isempty(strtrim(raw_chord))
    fprintf('\n%s\n', repmat('-',1,60));
    fprintf('--- OTOMATIK AIRFOIL BOYUTLANDIRMA ---\n');
    fprintf('%s\n', repmat('-',1,60));

    model_chord_cm  = test_L_cm * 0.30;
    fprintf('  Kord (chord)           : %6.2f cm\n', model_chord_cm);
    fprintf('    -> Kural : iz bolgesi parazitini onlemek icin L_test in %%30 u.\n');
    fprintf('       (Barlow, Rae & Pope 1999, s.369)\n');

    span_cm   = test_w_cm * 0.80;
    bl_gap_cm = (test_w_cm - span_cm) / 2;
    fprintf('  Span (kanat acikligi)  : %6.2f cm\n', span_cm);
    fprintf('  Sinir tabaka boslugu   : %6.2f cm (her iki yan)\n', bl_gap_cm);
    if bl_gap_cm >= 2.0 && bl_gap_cm <= 3.0
        fprintf('    -> Kural : 2-3 cm bosluk SAGLANIYOR.\n');
    elseif bl_gap_cm < 2.0
        fprintf('    -> [UYARI] Bosluk < 2 cm! Test kesiti genisletilmeli.\n');
    else
        fprintf('    -> [NOT] Bosluk > 3 cm; muhafazakar secim.\n');
    end

    span_m         = span_cm * cm2m;
    max_frontal_m2 = A_test * 0.05;
    max_kalinlik_m  = max_frontal_m2 / span_m;
    max_kalinlik_cm = max_kalinlik_m * 100;
    fprintf('  Maks. profil kalinligi : %6.2f cm  (A_frontal_max = %.4f m2)\n', ...
            max_kalinlik_cm, max_frontal_m2);
    fprintf('    -> Kural : Solid Blockage <= %%5 (Maskell 1963; B-R-P s.374)\n');
    fprintf('%s\n', repmat('-',1,60));

    model_chord = model_chord_cm * cm2m;
    % Model frontal alani (2D icin kalinlik x span)
    A_model = max_kalinlik_m * span_m;

else
    model_chord_cm = str2double(strtrim(raw_chord));
    assert(isfinite(model_chord_cm) && model_chord_cm > 0, ...
        '[HATA] Model kordu pozitif sonlu sayi olmali.');
    model_chord = model_chord_cm * cm2m;
    span_m      = test_w;          % 2D airfoil: tam genislik duvardan duvara
    A_model     = NaN;             % Kullanici kord girdiyse kalinlik bilinmiyor
end

fprintf('%s\n', repmat('-',1,60));

%% -------------------------------------------------------------------------
%% 3. GIRDI KONTROL MEKANIZMASI
%% -------------------------------------------------------------------------

assert(isfinite(V_test) && V_test > 0,  '[HATA] V_test pozitif olmali.');
assert(isfinite(T_degC) && T_degC > -273.15, '[HATA] T_degC gecersiz.');
assert(isfinite(P_stat) && P_stat > 0,  '[HATA] P_stat pozitif olmali.');
assert(isfinite(fan_verimi) && fan_verimi > 0 && fan_verimi <= 1, ...
    '[HATA] fan_verimi (0,1] araliginda olmali.');
assert(all([test_w, test_h, test_L, nozzle_in_w, nozzle_in_h] > 0), ...
    '[HATA] Boyut girdileri pozitif olmali.');
assert(L_nozzle_horiz > 0, '[HATA] Nozzle uzunlugu pozitif olmali.');
assert(isfinite(model_chord) && model_chord > 0, ...
    '[HATA] model_chord pozitif sonlu sayi olmali.');
assert(AR_diffuser >= 1, '[HATA] AR_diffuser >= 1 olmali.');
assert(L_diffuser > 0, '[HATA] L_diffuser pozitif olmali.');

%% -------------------------------------------------------------------------
%% 4. HAVA OZELLIKLERI
%% -------------------------------------------------------------------------

R_air  = 287.058;
gamma  = 1.400;
T_K    = T_degC + 273.15;

rho    = P_stat / (R_air * T_K);

mu_ref = 1.716e-5; T_ref = 273.15; S_suth = 110.4;
mu = mu_ref * (T_K/T_ref)^1.5 * (T_ref + S_suth)/(T_K + S_suth);

a_sound   = sqrt(gamma * R_air * T_K);
Mach      = V_test / a_sound;
T_total_K = T_K * (1 + (gamma-1)/2 * Mach^2);
P_total   = P_stat * (T_total_K / T_K)^(gamma/(gamma-1));

fprintf('\n%s\n', repmat('=',1,60));
fprintf('   RUZGAR TUNELI --- ON HESAP TABLOSU  (v5.1 - Gercek Geometri)\n');
fprintf('%s\n', repmat('=',1,60));
fprintf('\n--- HAVA OZELLIKLERI (T=%.1f degC, P=%.0f Pa) ---\n', T_degC, P_stat);
fprintf('  rho          : %8.4f  kg/m3\n', rho);
fprintf('  mu           : %8.2e  Pa.s  (Sutherland)\n', mu);
fprintf('  a_sound      : %8.2f  m/s\n', a_sound);
fprintf('  Mach         : %8.4f  [-]\n', Mach);
fprintf('  T0           : %8.2f  K  (%.2f degC)\n', T_total_K, T_total_K-273.15);
fprintf('  P0           : %8.0f  Pa\n', P_total);

%% -------------------------------------------------------------------------
%% 5. TEST KESITI HESAPLARI
%% -------------------------------------------------------------------------

P_wet   = 2*(test_w + test_h);
Dh_out  = 4*A_test / P_wet;         % Hidrolik cap (= Dh_test = Dh1) [m]
Q       = A_test * V_test;
mdot    = rho * Q;
Re_out  = rho * V_test * Dh_out / mu;
q_test  = 0.5 * rho * V_test^2;

% Prandtl Evrensel Surtunme Yasasi (Barlow, Rae & Pope Eq. 3.14)
% 1/sqrt(f) = 2*log10(Re * sqrt(f)) - 0.8
if isfinite(f_Darcy)
    f_test = f_Darcy;
else
    f_Prandtl = 0.02; % Baslangic tahmini
    for iter = 1:10
        f_Prandtl = (2 * log10(Re_out * sqrt(f_Prandtl)) - 0.8)^(-2);
    end
    f_test = f_Prandtl;
end
tau_w = f_test/8 * rho * V_test^2;

fprintf('\n--- TEST KESITI (V = %.2f m/s) ---\n', V_test);
fprintf('  Boyutlar (GxYxU)       : %.1f x %.1f x %.1f cm\n', test_w_cm, test_h_cm, test_L_cm);
fprintf('  A_test                 : %8.4f  m2\n', A_test);
fprintf('  Dh_out  (=Dh_test)     : %8.2f  cm  (%.4f m)\n', Dh_out*100, Dh_out);
fprintf('  L/Dh                   : %8.2f  [-]\n', test_L/Dh_out);
fprintf('  Q                      : %8.4f  m3/s  ->  %.2f m3/h\n', Q, 3600*Q);
fprintf('  mdot                   : %8.4f  kg/s\n', mdot);
fprintf('  Re_out                 : %8.0f  [-]\n', Re_out);
fprintf('  q_test                 : %8.2f  Pa\n', q_test);
fprintf('  f_test (Prandtl Eq.3.14): %7.4f  [-]\n', f_test);
fprintf('  tau_w                  : %8.4f  Pa\n', tau_w);
Re_c = rho * V_test * model_chord / mu;
fprintf('  Re_kord                : %8.0f  [-]  (c = %.2f cm)\n', Re_c, model_chord_cm);

%% -------------------------------------------------------------------------
%% 6. NOZZLE GEOMETRISI + WATTENDORF K_nozzle
%% -------------------------------------------------------------------------
%  Giris: KARE  A_in = W_in * H_in
%  Cikis: KARE  A_out = A_test
%  Wattendorf: K_nozzle = f_avg * (L/Dh_in) * 0.32

A_in      = nozzle_in_w * nozzle_in_h;
P_in      = 2*(nozzle_in_w + nozzle_in_h);
Dh_in     = 4*A_in / P_in;
CR        = A_in / A_test;
V_in      = Q / A_in;
q_in      = 0.5 * rho * V_in^2;
dp_bernoulli_nozzle = q_in - q_test;

haaland = @(Re) (1 / (-1.8 * log10(6.9/max(Re,4001))))^2;

Re_in_nz  = rho * V_in * Dh_in / mu;
f_in_nz   = haaland(Re_in_nz);
f_out_nz  = haaland(Re_out);
f_avg_nz  = (f_in_nz + f_out_nz) / 2;
K_nozzle = f_avg_nz * (L_nozzle_horiz / Dh_out) * 0.32;
dp_nozzle = K_nozzle * q_test;

fprintf('\n--- NOZZLE (DARALMA KONISI) ---\n');
fprintf('  Giris geometrisi       : KARE (%.1f x %.1f cm)\n', nozzle_in_w_cm, nozzle_in_h_cm);
fprintf('  Cikis geometrisi       : KARE (test kesiti)\n');
fprintf('  Eksenel Uzunluk (L)    : %8.2f  cm  (%.4f m)\n', L_nozzle_horiz_cm, L_nozzle_horiz);
fprintf('  Giris Dh_in            : %8.2f  cm  (%.4f m)\n', Dh_in*100, Dh_in);
fprintf('  Giris Alani (A_in)     : %8.4f  m2\n', A_in);
fprintf('  Cikis Alani (A_test)   : %8.4f  m2\n', A_test);
fprintf('  Daralma Orani (CR)     : %8.3f  [-]\n', CR);
fprintf('  Giris Hizi (V_in)      : %8.3f  m/s\n', V_in);
fprintf('  Giris Dyn. Basinci     : %8.2f  Pa\n', q_in);
fprintf('  Bernoulli Dp (p_test-p_in): %+.2f Pa\n', dp_bernoulli_nozzle);
fprintf('  --- Wattendorf K_nozzle ---\n');
fprintf('  Re_in                  : %8.0f  [-]\n', Re_in_nz);
fprintf('  Re_out (=Re_test)      : %8.0f  [-]\n', Re_out);
fprintf('  f_avg                  : %8.5f  [-]\n', f_avg_nz);
fprintf('  K_nozzle (Wattendorf)  : %8.5f  [-]\n', K_nozzle);
fprintf('  dP_nozzle              : %8.3f  Pa\n', dp_nozzle);

%% -------------------------------------------------------------------------
%% 7. DIFUZOR KAYBI  (Barlow Eq. 3.24-3.27 + Eckert vd. orijinal K_e)
%% -------------------------------------------------------------------------
%  K_d  = K_f + K_ex                                  (Barlow Eq. 3.25)
%  K_f  = (1 - 1/AR^2) * f / (8 sin(theta))           (Barlow Eq. 3.26)
%  K_ex = K_e(2*theta) * ((AR-1)/AR)^2                (Barlow Eq. 3.27)
%  K_e  : Eckert vd. Ek B (B4-B14), 2*theta [derece] cinsinden.

% --- Esdeger koni acisi (Barlow Eq. 3.24, AR tabanli ifade) ---
theta_e_rad = atan(0.5 * (sqrt(AR_diffuser) - 1) / (L_diffuser / Dh_out));
theta_e_deg = rad2deg(theta_e_rad);
phi_deg     = 2 * theta_e_deg;          % toplam koni acisi 2*theta [derece]

% --- Surtunme kaybi ---
% Barlow: f, sabit kesitli bolumdeki gibi (Prandtl Eq. 3.14) GIRIS Re ile.
% Difuzor girisi = test kesiti cikisi oldugu icin f_diff = f_test.
Re_diff = Re_out;
f_diff  = f_test;
K_f     = (1 - 1/AR_diffuser^2) * f_diff / (8 * sin(theta_e_rad));

% --- Genisleme kaybi: temel bagintilar (Eckert vd. B4-B13) ---
K_e_daire  = Ke_daire(phi_deg);         % konik / dairesel kesit (B4-B6)
K_e_kare   = Ke_kare(phi_deg);          % kare kesit, DUZELTILMIS (B7-B9)
K_e_2Ddik  = Ke_2D_dikdortgen(phi_deg); % 2D dikdortgen (B10-B13)
K_e_2Ddai  = K_e_2Ddik * (K_e_daire / K_e_kare);   % 2D dairesel yanli
K_e_3Dort  = (K_e_kare  + K_e_daire) / 2;          % 3D ortalama
K_e_2Dort  = (K_e_2Ddik + K_e_2Ddai) / 2;          % 2D ortalama

% --- Duzlemsellik orani delta_s (Eckert vd.) ---
% Uc boyutlar: giris kare (w1 x h1), cikis daire (w2 = h2 = D).
w1 = test_w;          h1 = test_h;
w2 = diffuser_out_D;  h2 = diffuser_out_D;
dw = w2 - w1;  dh = h2 - h1;
if dw == 0 || dh == 0
    delta_s = 0;                         % bir boyut sabit -> tamamen duzlemsel
else
    delta_s = min(dh/dw, dw/dh);
    if delta_s < 0, delta_s = 0; end
end

% --- Gecis difuzoru: giris kare, cikis dairesel -> ortalama bagintilar ---
K_e_temel = K_e_3Dort;
K_e_ek    = K_e_2Dort;
K_e       = K_e_temel + (1 - delta_s) * (K_e_ek - K_e_temel);   % (B14)

K_ex       = K_e * ((AR_diffuser - 1) / AR_diffuser)^2;
K_diff_ref = K_f + K_ex;
dp_diff    = K_diff_ref * q_test;

% --- Hangi aralik kullanildi? ---
if phi_deg < 3
    aralik_txt = '2*theta < 3 der.  -> dogrusal (B5/B8)';
elseif phi_deg <= 10
    aralik_txt = '3 <= 2*theta <= 10 der. -> polinom (B4/B7)';
else
    aralik_txt = '2*theta > 10 der. -> dogrusal (B6/B9)';
end

fprintf('\n--- DIFUZOR KAYBI (Barlow Eq. 3.24-3.27 + Eckert vd. K_e) ---\n');
fprintf('  Giris (Kare)           : %.1f x %.1f cm\n', test_w_cm, test_h_cm);
fprintf('  Cikis (Dairesel)       : Cap D = %.1f cm\n', diffuser_out_D_cm);
fprintf('  L_diffuser             : %8.2f  cm  (%.3f m)\n', L_diffuser_cm, L_diffuser);
fprintf('  AR (A2/A1)             : %8.4f  [-]\n', AR_diffuser);
fprintf('  theta_e (yarim aci)    : %8.3f  derece\n', theta_e_deg);
fprintf('  2*theta_e (toplam aci) : %8.3f  derece\n', phi_deg);
fprintf('  K_e araligi            : %s\n', aralik_txt);
fprintf('  Re_diff (giris)        : %8.0f  [-]\n', Re_diff);
fprintf('  f_diff (Prandtl, giris Re): %6.5f  [-]\n', f_diff);
fprintf('  K_f (cidar surt.)      : %8.5f  [-]\n', K_f);
fprintf('  K_e daire  (B4-B6)     : %8.5f  [-]\n', K_e_daire);
fprintf('  K_e kare   (B7-B9, duz.): %7.5f  [-]\n', K_e_kare);
fprintf('  K_e 3D ortalama        : %8.5f  [-]\n', K_e_3Dort);
fprintf('  delta_s (duzlemsellik) : %8.3f  [-]  (1: tam 3D, 0: duzlemsel)\n', delta_s);
fprintf('  K_e (B14, kullanilan)  : %8.5f  [-]\n', K_e);
fprintf('  K_ex (genisleme)       : %8.5f  [-]\n', K_ex);
fprintf('  K_diffuser_ref         : %8.5f  [-]\n', K_diff_ref);
fprintf('  dP_diffuser            : %8.3f  Pa\n', dp_diff);
if theta_e_deg > 3.0
    fprintf('  [UYARI] theta_e = %.2f der. > 3 der. (Barlow s.81 onerisi).\n', theta_e_deg);
    fprintf('          Ayrilma riski var; K_e ayrilmasiz akisi temsil eder.\n');
end
if AR_diffuser > 6.0
    fprintf('  [UYARI] AR = %.2f > 6 (Barlow s.81: toplam difuzor AR genelde 5-6).\n', AR_diffuser);
end

%% -------------------------------------------------------------------------
%% 8. CIKIS ATIM KAYBI  (Barlow Section 3.3)
%% -------------------------------------------------------------------------
K_exit_ref = 1.0 / AR_diffuser^2;
dp_exit    = K_exit_ref * q_test;

fprintf('\n--- CIKIS ATIM KAYBI ---\n');
fprintf('  K_exit_ref (1/AR^2)    : %8.5f  [-]\n', K_exit_ref);
fprintf('  dP_exit                : %8.3f  Pa\n', dp_exit);

%% -------------------------------------------------------------------------
%% 9. DINLENME ODASI KAYIPLARI (Barlow Eq. 3.36-3.43)
%% -------------------------------------------------------------------------
K_h_local = lambda_h * (Lh_Dh + 3) * (1/beta_h)^2 + (1/beta_h - 1)^2;

beta_s   = (1 - d_w/w_m)^2;
sigma_s  = 1 - beta_s;
Re_w     = rho * V_in * d_w / mu;

if Re_w < 400
    K_Rn = 0.785 * (Re_w/241 + 1.0)^(-4) + 1.01;
else
    K_Rn = 1.0;
end
K_screen_local = K_mesh * K_Rn * sigma_s + sigma_s^2 / beta_s^2;

K_settling_ref = (K_h_local + N_screens * K_screen_local) / CR^2;
dp_settling    = K_settling_ref * q_test;

fprintf('\n--- DINLENME ODASI KAYIPLARI ---\n');
fprintf('  Balpetegi K_h_local    : %8.5f  [-]\n', K_h_local);
fprintf('  Ekran K_screen_local   : %8.5f  [-]\n', K_screen_local);
fprintf('  CR^2 referanslama      : %8.3f  [-]\n', CR^2);
fprintf('  K_settling_ref         : %8.5f  [-]\n', K_settling_ref);
fprintf('  dP_settling            : %8.3f  Pa\n', dp_settling);

%% -------------------------------------------------------------------------
%% 10. MODEL SURUKLENME KAYBI  (Barlow Section 3.5)
%% -------------------------------------------------------------------------
if is_2D_airfoil
    if isfinite(A_model)
        K_model_ref = Cd_model * (A_model / A_test);
        dp_model    = K_model_ref * q_test;
        fprintf('\n--- MODEL SURUKLENME KAYBI (2D Airfoil) ---\n');
        fprintf('  Cd_model               : %8.3f  [-]\n', Cd_model);
        fprintf('  A_model (kalinlik*span): %8.4f  m2\n', A_model);
        fprintf('  K_model_ref            : %8.5f  [-]\n', K_model_ref);
        fprintf('  dP_model               : %8.3f  Pa\n', dp_model);
    else
        K_model_ref = 0; dp_model = 0;
        fprintf('\n--- MODEL SURUKLENME KAYBI ---\n');
        fprintf('  [NOT] Model kalinligi bilinmiyor (kullanici kord girdi).\n');
        fprintf('        A_model hesaplanamadi -> dP_model = 0 alindi.\n');
    end
else
    K_model_ref = 0; dp_model = 0;
end

%% -------------------------------------------------------------------------
%% 11. MACH / KOMPRESIBILITE
%% -------------------------------------------------------------------------
fprintf('\n--- KOMPRESIBILITE ---\n');
if Mach < 0.3,     fprintf('  Mach=%.4f -> Inkompresibilite UYGUN.\n', Mach);
elseif Mach < 0.7, fprintf('  Mach=%.4f -> Kompresibilite duzeltmesi ONERILIR.\n', Mach);
else,              fprintf('  Mach=%.4f -> Izoentropik iliskiler kullanilmali!\n', Mach);
end

%% -------------------------------------------------------------------------
%% 12. BASINC KAYBI OZET + FAN GUC TAHMINI
%% -------------------------------------------------------------------------
% f_test Bolum 5'te belirlendi (f_Darcy girildiyse o, yoksa Prandtl Eq. 3.14)
K_test  = f_test * (test_L / Dh_out);
dp_test = K_test * q_test;

K_total  = K_nozzle + K_test + K_diff_ref + K_exit_ref + K_settling_ref + K_model_ref;
dp_total = K_total * q_test;

P_fan_ideal  = dp_total * Q;
P_fan_gercek = P_fan_ideal / fan_verimi;
HP_gercek    = P_fan_gercek / 745.7;

fprintf('\n--- BASINC KAYBI OZET (V_test = %.1f m/s) ---\n', V_test);
fprintf('  %-30s : K = %8.5f  -> dP = %8.3f Pa\n', 'Nozzle (Wattendorf)',   K_nozzle,       dp_nozzle);
fprintf('  %-30s : K = %8.5f  -> dP = %8.3f Pa\n', 'Test kesiti (Prandtl Eq. 3.14)', K_test, dp_test);
fprintf('  %-30s : K = %8.5f  -> dP = %8.3f Pa\n', 'Difuzor (Barlow + Eckert)', K_diff_ref, dp_diff);
fprintf('  %-30s : K = %8.5f  -> dP = %8.3f Pa\n', 'Cikis atim kaybi',      K_exit_ref,     dp_exit);
fprintf('  %-30s : K = %8.5f  -> dP = %8.3f Pa\n', 'Dinlenme odasi',        K_settling_ref, dp_settling);
fprintf('  %-30s : K = %8.5f  -> dP = %8.3f Pa\n', 'Model suruklenme',      K_model_ref,    dp_model);
fprintf('  %s\n', repmat('-',1,55));
fprintf('  %-30s : K = %8.5f  -> dP = %8.3f Pa\n', 'TOPLAM DEVRE',          K_total,        dp_total);
fprintf('\n  Fan verimi (eta)       : %.0f%%\n', fan_verimi*100);
fprintf('  P_fan_gercek           : %8.2f  W  (%.4f kW)  ~ %.2f HP\n', P_fan_gercek, P_fan_gercek/1000, HP_gercek);
fprintf('  DP_fan_min             : %.3f Pa  |  1.2x guvenlik: %.3f Pa\n', dp_total, 1.2*dp_total);

%% -------------------------------------------------------------------------
%% 13. HIZ DUYARLILIK TABLOSU
%% -------------------------------------------------------------------------
V_arr    = [5; 10; 20; 30; 40; 50; 60];
Q_arr    = A_test .* V_arr;
Re_arr   = rho .* V_arr .* Dh_out ./ mu;
q_arr    = 0.5 .* rho .* V_arr.^2;
Mach_arr = V_arr ./ a_sound;

f_test_arr = zeros(size(V_arr));
for ii = 1:numel(V_arr)
    Re_i = rho * V_arr(ii) * Dh_out / mu;
    f_i = 0.02;
    for iter = 1:10
        f_i = (2 * log10(Re_i * sqrt(f_i)) - 0.8)^(-2);
    end
    f_test_arr(ii) = f_i;
end
dp_test_arr = f_test_arr .* (test_L/Dh_out) .* q_arr;

V_in_arr      = Q_arr ./ A_in;
Re_in_arr     = rho .* V_in_arr .* Dh_in ./ mu;
f_in_arr      = arrayfun(@(Re) haaland(Re), Re_in_arr);
f_out_arr     = arrayfun(@(Re) haaland(Re), Re_arr);
f_avg_arr     = (f_in_arr + f_out_arr) / 2;
K_nozzle_arr = f_avg_arr .* (L_nozzle_horiz / Dh_out) .* 0.32;
dp_nozzle_arr = K_nozzle_arr .* q_arr;

% Difuzor: f giris Re ile Prandtl (Bolum 7 ile tutarli); K_ex geometriye bagli
f_diff_arr    = f_test_arr;
K_f_arr       = (1 - 1/AR_diffuser^2) .* f_diff_arr ./ (8 * sin(theta_e_rad));
K_diff_arr    = K_f_arr + K_ex;
dp_diff_arr   = K_diff_arr .* q_arr;

dp_exit_arr   = K_exit_ref .* q_arr;

Re_w_arr      = rho .* V_in_arr .* d_w ./ mu;
K_Rn_arr      = arrayfun(@(Rw) (Rw<400)*(0.785*(Rw/241+1)^(-4)+1.01) + (Rw>=400)*1.0, Re_w_arr);
K_scr_arr     = K_mesh .* K_Rn_arr .* sigma_s + sigma_s^2/beta_s^2;
K_set_arr     = (K_h_local + N_screens .* K_scr_arr) ./ CR^2;
dp_set_arr    = K_set_arr .* q_arr;

dp_model_arr  = K_model_ref .* q_arr;
dp_total_arr  = dp_test_arr + dp_nozzle_arr + dp_diff_arr + dp_exit_arr + dp_set_arr + dp_model_arr;
P_fan_arr     = dp_total_arr .* Q_arr / fan_verimi;

Ttbl = table(V_arr, round(3600*Q_arr,1), round(Re_arr,0), round(q_arr,1), ...
             round(dp_test_arr,2), round(dp_nozzle_arr,2), round(dp_diff_arr,2), ...
             round(dp_exit_arr,2), round(dp_set_arr,2), round(dp_total_arr,2), ...
             round(P_fan_arr/1000, 3), ...
    'VariableNames', {'V_m_s','Q_m3_h','Re_Dh','q_Pa', ...
                      'dP_test','dP_nozz','dP_diff','dP_exit', ...
                      'dP_set','dP_tot_Pa','P_fan_kW'});

fprintf('\n--- HIZ DUYARLILIK TABLOSU ---\n');
disp(Ttbl);

%% -------------------------------------------------------------------------
%% 14. GRAFIKLER
%% -------------------------------------------------------------------------

figure('Name','Ruzgar Tuneli v5.1 (Gercek Geometri)','NumberTitle','off', ...
       'Units','normalized','Position',[0.04 0.04 0.92 0.88]);

% --- 1: Hacimsel Debi ---
subplot(2,3,1);
plot(V_arr, 3600*Q_arr,'bo-','LineWidth',1.8,'MarkerFaceColor','b');
xlabel('V [m/s]'); ylabel('Q [m^3/h]'); title('Hacimsel Debi'); grid on;
xline(V_test,'r--','LineWidth',1.2,'Label',sprintf('V=%.1f',V_test));

% --- 2: Dinamik Basinc ---
subplot(2,3,2);
plot(V_arr, q_arr,'rs-','LineWidth',1.8,'MarkerFaceColor','r');
xlabel('V [m/s]'); ylabel('q [Pa]'); title('Dinamik Basinc'); grid on;
xline(V_test,'r--','LineWidth',1.2,'Label',sprintf('V=%.1f',V_test));

% --- 3: Reynolds ---
subplot(2,3,3);
semilogy(V_arr, Re_arr,'k^-','LineWidth',1.8,'MarkerFaceColor','k');
xlabel('V [m/s]'); ylabel('Re_{Dh}'); title('Reynolds Sayisi'); grid on;
yline(4000,'b--','Lam.|Turb.','LabelHorizontalAlignment','left');
xline(V_test,'r--','LineWidth',1.2,'Label',sprintf('V=%.1f',V_test));

% --- 4: Nozzle Kesit Semasi (Kare -> Kare Dogrusal Temsil) ---
subplot(2,3,4);
xc = [0, L_nozzle_horiz_cm, L_nozzle_horiz_cm, 0, 0];
yc = [nozzle_in_h_cm/2, test_h_cm/2, -test_h_cm/2, -nozzle_in_h_cm/2, nozzle_in_h_cm/2];
fill(xc, yc, [0.75 0.85 1.0], 'EdgeColor', 'b', 'LineWidth', 1.5); hold on;
plot([0 L_nozzle_horiz_cm], [0 0], 'k--', 'LineWidth', 0.8);
text(L_nozzle_horiz_cm/2, nozzle_in_h_cm/2 * 1.10, sprintf('CR = %.2f', CR), ...
     'HorizontalAlignment', 'center', 'FontSize', 9, 'FontWeight', 'bold');
text(0, 0, sprintf('%dx%d cm', nozzle_in_w_cm, nozzle_in_h_cm), 'HorizontalAlignment', 'right', 'VerticalAlignment', 'middle', 'FontSize', 8);
text(L_nozzle_horiz_cm, 0, sprintf('%dx%d cm', test_w_cm, test_h_cm), 'HorizontalAlignment', 'left', 'VerticalAlignment', 'middle', 'FontSize', 8);
hold off; axis equal; grid on;
xlabel('Eksenel Uzn. [cm]'); ylabel('Yari-Yukseklik [cm]');
title(sprintf('Daralma Konisi L=%.0f cm', L_nozzle_horiz_cm));

% --- 5: Basinc Kayip Dagilimi (yigili alan grafigi) ---
subplot(2,3,5);
area(V_arr, [dp_nozzle_arr, dp_test_arr, dp_diff_arr, ...
             dp_exit_arr, dp_set_arr, dp_model_arr], 'LineWidth',0.5);
legend('Nozzle','Test','Difuzor','Cikis Atim','Settling','Model', ...
       'Location','northwest','FontSize',7);
xlabel('V [m/s]'); ylabel('\Deltap [Pa]');
title('Basinc Kayip Dagilimi (yigili)'); grid on;
xline(V_test,'r--','LineWidth',1.2,'Label',sprintf('V=%.1f',V_test));

% --- 6: Fan Guc Tahmini ---
subplot(2,3,6);
plot(V_arr, P_fan_arr/1000,'go-','LineWidth',1.8,'MarkerFaceColor','g');
xlabel('V [m/s]'); ylabel('P_{fan} [kW]');
title(sprintf('Fan Guc (eta=%.0f%%)',fan_verimi*100)); grid on;
xline(V_test,'r--','LineWidth',1.2,'Label',sprintf('V=%.1f',V_test));

sgtitle(sprintf('Ruzgar Tuneli 1D On Hesap v5.1 | V_{test}=%.1f m/s',V_test), ...
        'FontSize',12,'FontWeight','bold');

fprintf('\n%s\n', repmat('=',1,60));
fprintf('  Tum hesaplamalar basariyla tamamlandi (v5.1).\n');
fprintf('%s\n', repmat('=',1,60));


%% -------------------------------------------------------------------------
%% 15. CFD ON HAZIRLIK (mesh icin ilk hucre ve inflation)
%% -------------------------------------------------------------------------
yplus_hedef = 1;      % k-omega SST icin duvar cozumlu
r_buyume    = 1.2;    % inflation buyume orani

u_tau = sqrt(tau_w/rho);                              % surtunme hizi
y1    = yplus_hedef*mu/(rho*u_tau);                   % ilk hucre yuksekligi [m]
x_bl  = L_nozzle_horiz + test_L;                      % SL gelisme mesafesi
delta = 0.37*x_bl/(rho*V_test*x_bl/mu)^0.2;           % turbulansli SL kalinligi
N_inf = ceil(log(1 + delta*(r_buyume-1)/y1)/log(r_buyume));
t_son = y1*r_buyume^(N_inf-1);                        % son katman kalinligi

fprintf('\n--- CFD ON HAZIRLIK ---\n');
fprintf('  Velocity-inlet hizi    : %8.3f m/s\n', V_in);
fprintf('  Surtunme hizi u_tau    : %8.4f m/s\n', u_tau);
fprintf('  Ilk hucre (y+=%g)      : %8.4f mm\n', yplus_hedef, y1*1e3);
fprintf('  SL kalinligi ~         : %8.2f mm\n', delta*1e3);
fprintf('  Inflation katmani      : %d (buyume %.1f)\n', N_inf, r_buyume);
fprintf('  Son katman kalinligi   : %8.2f mm\n', t_son*1e3);


%% =========================================================================
%% YEREL FONKSIYONLAR: Difuzor genisleme kaybi K_e (Eckert vd., Ek B)
%%   Girdi p = 2*theta [derece] (toplam esdeger koni acisi)
%%   Not: Barlow Eq. 3.28-3.29 ayni bagintilarin theta (yarim aci)
%%   cinsinden yazilmis halidir; kare bagintisinda yazim hatalari vardir.
%% =========================================================================

function K = Ke_daire(p)
    % Konik / dairesel kesit (B4-B6). Barlow Eq. 3.28 ile ayni (dogru).
    if p < 3
        K = 1.033395e-1 - 1.19465e-2*p;
    elseif p <= 10
        K = 1.70925e-1 - 5.84932e-2*p + 8.14936e-3*p^2 + 1.34777e-4*p^3 ...
            - 5.67258e-5*p^4 - 4.15879e-7*p^5 + 2.10219e-7*p^6;
    else
        K = -9.66135e-2 + 2.336135e-2*p;
    end
end

function K = Ke_kare(p)
    % Kare kesit (B7-B9). Orijinal katsayilar (Barlow Eq. 3.29 hatalidir).
    if p < 3
        K = 9.62274e-2 - 2.07582e-3*p;
    elseif p <= 10
        K = 1.22156e-1 - 2.29480e-2*p + 5.50704e-3*p^2 - 4.08644e-4*p^3 ...
            - 3.84056e-5*p^4 + 8.74969e-6*p^5 - 3.65217e-7*p^6;
    else
        K = -1.321685e-1 + 2.93315e-2*p;
    end
end

function K = Ke_2D_dikdortgen(p)
    % Kare giris kesitli 2D (duzlemsel) dikdortgen difuzor (B10-B13).
    if p < 3
        K = 1.0e-1 - 5.333333e-3*p;
    elseif p <= 9
        K = 3.23334e-1 - 5.82939e-2*p - 4.97151e-2*p^2 + 1.99093e-2*p^3 ...
            - 1.98630e-3*p^4 + 2.06857e-5*p^5 + 3.81387e-6*p^6;
    elseif p <= 10
        K = 5.72853 - 1.21832*p + 7.08483e-2*p^2;
    else
        K = -1.36146 + 1.986460e-1*p;
    end
end
