# Offline spelling dependencies
nspell 2.1.5 (MIT), dictionary-en-gb 3.0.0 (MIT AND BSD), is-buffer (MIT).
Full upstream licences are included beside the assets. The British dictionary is supplemented with Indian English terms in spelling.js; it is not an exhaustive Indian English dictionary.
Rebuild from the project folder with npm ci and npm run build:spelling. Runtime loads only these packaged files, with no CDN or external spelling service.
