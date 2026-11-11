# Smokeline

Interactive one-dimensional design sheet for low-speed wind tunnels, live at
[windtunnel-theta.vercel.app](https://windtunnel-theta.vercel.app).

- **Open circuit:** settling chamber, contraction, test section and diffuser sizing, loss budget, fan power,
  speed sweep and export to MATLAB (`ruzgar_tuneli_hesap.m`). Based on Barlow, Rae & Pope (1999) and
  Eckert, Mort & Jope (1976).
- **Closed-circuit icing tunnel** (`#icing`, `kapali_devre_1D.m` v1.6): loss loop, single fan with hub fairing, iced-loss scenarios, operating cycle, thermal and icing budget,
  literature-based design audit with one-click fixes, and a PDF datasheet export.
- **Coil designer** (`icing/coil.js`, `icing/coilview.js`): rates a two-stage finned-tube cooling coil against the tunnel's heat load
  (air-side film, fin efficiency, tube-side film, UA, ε-NTU, required fluid temperature, leading-edge ice blockage), with an
  interactive 3D model, a to-scale section drawing and a specification sheet for manufacturers. Preliminary rating; the
  status of every relation is listed at the top of `icing/coil.js`.

It is a preliminary design estimate. It does not replace detailed design, CFD or measurement.

## License

Smokeline is licensed under the [GNU Affero General Public License v3.0](LICENSE).

For commercial use under other terms, for example embedding a customised version on a company website
without releasing your own source code, a separate commercial license is available.
Contact: smokeline.w [at] gmail.com

© Kerim Yılmaz
