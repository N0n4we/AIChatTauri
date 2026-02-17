{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Tauri dependencies
    pkg-config
    openssl
    webkitgtk_4_1
    gtk3
    cairo
    gdk-pixbuf
    glib
    dbus
    librsvg

    # Build tools
    cargo
    rustc
    nodejs
    pnpm

    # System libraries
    zlib
    libsoup_3
  ];

  shellHook = ''
    export PKG_CONFIG_PATH="${pkgs.openssl.dev}/lib/pkgconfig:${pkgs.webkitgtk_4_1}/lib/pkgconfig:${pkgs.gtk3}/lib/pkgconfig:$PKG_CONFIG_PATH"
    export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [ pkgs.webkitgtk_4_1 pkgs.gtk3 pkgs.cairo pkgs.gdk-pixbuf pkgs.glib pkgs.dbus pkgs.zlib pkgs.libsoup_3 ]}:$LD_LIBRARY_PATH"
    export XDG_DATA_DIRS="$GSETTINGS_SCHEMAS_PATH"
  '';
}
