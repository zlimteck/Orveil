import React from 'react';
import { siCloudflare, siAdguard, siSyncthing, siProxmox, siImmich, siPortainer, siHomeassistant, siJellyfin, siMysql, siRedis, siOllama, siMongodb, siTailscale, siSonarr, siRadarr, siQbittorrent, siRclone, siHetzner } from 'simple-icons';
import { Globe, Activity, Terminal, HeartPulse, Gauge, Network, Database, ArrowLeftRight, Workflow } from 'lucide-react';

function SimpleIcon({ icon, size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={`#${icon.hex}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={icon.title}
    >
      <path d={icon.path} />
    </svg>
  );
}

function HmsIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="20" height="5" rx="1.5" fill="#a7e2e3" />
      <rect x="2" y="10" width="20" height="5" rx="1.5" fill="#a7e2e3" opacity=".7" />
      <rect x="2" y="17" width="20" height="4" rx="1.5" fill="#a7e2e3" opacity=".45" />
      <circle cx="19" cy="5.5" r="1" fill="#80cfa9" />
      <circle cx="19" cy="12.5" r="1" fill="#80cfa9" opacity=".7" />
    </svg>
  );
}

function UnraidIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="20" height="4" rx="1" fill="#F15A2B" opacity=".9"/>
      <rect x="2" y="10" width="20" height="4" rx="1" fill="#F15A2B" opacity=".65"/>
      <rect x="2" y="17" width="20" height="4" rx="1" fill="#F15A2B" opacity=".4"/>
      <circle cx="19" cy="5" r="1.1" fill="#fff" opacity=".9"/>
      <circle cx="19" cy="12" r="1.1" fill="#fff" opacity=".65"/>
    </svg>
  );
}

function DockerIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 18" width={size} height={Math.round(size * 18 / 24)} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill="#2496ED" d="M13.4 4.5h2.2V2.3h-2.2v2.2zm0 2.7h2.2V5h-2.2v2.2zm-2.7 0h2.2V5h-2.2v2.2zm-2.7 0h2.2V5H8v2.2zm-2.7 0h2.2V5H5.3v2.2zm2.7-2.7h2.2V2.3H8V4.5zm2.7 0h2.2V2.3h-2.2V4.5zm0-2.7h2.2V-.1h-2.2V1.8zm-2.7 0h2.2V-.1H8V1.8zM23.3 8c-.5-.3-1.5-.4-2.3-.3-.1-.8-.6-1.6-1.3-2l-.4-.3-.3.4c-.4.5-.5 1.4-.5 2 0 .3 0 .8.3 1.3-.3.1-.8.3-1.5.3H.2l-.1.4c-.1.9 0 4.3 2 6.1.9.8 2.2 1.2 3.8 1.2 3.7 0 6.4-1.7 7.7-4.8.9 0 2.8.1 3.7-1.9l.2-.3-.4-.3zm-11 4.3H10v2.3h2.3v-2.3zm0-2.8H10v2.3h2.3V9.5zm2.7 2.8h-2.2v2.3h2.2v-2.3zm-2.7-5.5H10v2.2h2.3V6.8zM7.3 12.3H5v2.3h2.3v-2.3zm2.7 0H7.8v2.3H10v-2.3zm0-2.8H7.8v2.3H10V9.5zm-2.7 0H5v2.3h2.3V9.5zm-2.8 0H2.3v2.3h2.2V9.5zm2.8-2.7H5v2.2h2.3V6.8zm2.7 0H7.8v2.2H10V6.8z"/>
    </svg>
  );
}

function UltraccIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="6" width="18" height="13" rx="2" fill="#c9d7f8" opacity=".2" stroke="#c9d7f8" strokeWidth="1.5" />
      <path d="M3 10h18" stroke="#c9d7f8" strokeWidth="1.5" />
      <circle cx="7" cy="8" r="1" fill="#c9d7f8" />
      <path d="M8 14l2.5 3L14 12l2.5 4" stroke="#80cfa9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FALLBACKS = {
  cloudflare: ({ size }) => <SimpleIcon icon={siCloudflare} size={size} />,
  adguardhome: ({ size }) => <SimpleIcon icon={siAdguard}    size={size} />,
  syncthing:  ({ size }) => <SimpleIcon icon={siSyncthing}  size={size} />,
  proxmox:    ({ size }) => <SimpleIcon icon={siProxmox}    size={size} />,
  immich:     ({ size }) => <SimpleIcon icon={siImmich}     size={size} />,
  jellyfin:   ({ size }) => <SimpleIcon icon={siJellyfin}  size={size} />,
  portainer:  ({ size }) => <SimpleIcon icon={siPortainer}  size={size} />,
  hms:        ({ size }) => <HmsIcon size={size} />,
  ultracc:    ({ size }) => <UltraccIcon size={size} />,
  docker:     ({ size }) => <DockerIcon size={size} />,
  unraid:     ({ size }) => <UnraidIcon size={size} />,
  http:       ({ size }) => <Globe size={size} color="#c9d7f8" />,
  multistep:  ({ size }) => <Workflow size={size} color="#c9d7f8" />,
  ping:        ({ size }) => <Activity size={size} color="#80cfa9" />,
  portforward: ({ size }) => <ArrowLeftRight size={size} color="#818cf8" />,
  ssh:        ({ size }) => <Terminal size={size} color="#a7e2e3" />,
  heartbeat:  ({ size }) => <HeartPulse size={size} color="#f87171" />,
  homeassistant:  ({ size }) => <SimpleIcon icon={siHomeassistant} size={size} />,
  dns:            ({ size }) => <Network size={size} color="#a7e2e3" />,
  mysql:          ({ size }) => <SimpleIcon icon={siMysql} size={size} />,
  mongodb:        ({ size }) => <SimpleIcon icon={siMongodb} size={size} />,
  tailscale:      ({ size }) => <SimpleIcon icon={siTailscale} size={size} />,
  ollama:         ({ size }) => <span className="icon-theme-adapt"><SimpleIcon icon={siOllama} size={size} /></span>,
  sonarr:         ({ size }) => <SimpleIcon icon={siSonarr} size={size} />,
  radarr:         ({ size }) => <SimpleIcon icon={siRadarr} size={size} />,
  qbittorrent:    ({ size }) => <SimpleIcon icon={siQbittorrent} size={size} />,
  rclone:         ({ size }) => <SimpleIcon icon={siRclone} size={size} />,
  hetzner:        ({ size }) => <SimpleIcon icon={siHetzner} size={size} />,
};

function FileIcon({ type, size, onError, className }) {
  const [ext, setExt] = React.useState('png');
  return (
    <img
      src={`/icons/${type}.${ext}`}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
      onError={() => ext === 'png' ? setExt('svg') : onError()}
      alt={type}
    />
  );
}

function FaviconIcon({ url, size, onError }) {
  const proxied = `/api/favicon?url=${encodeURIComponent(url)}`;
  return (
    <img
      src={proxied}
      width={size}
      height={size}
      style={{ objectFit: 'contain', borderRadius: 3 }}
      onLoad={e => { if (e.target.naturalWidth <= 1) onError(); }}
      onError={onError}
      alt=""
    />
  );
}

export default function ServiceIcon({ type, size = 20, url, faviconUrl, serviceUrl, customIconUrl }) {
  const [useFavicon, setUseFavicon] = React.useState(true);
  const [useFallback, setUseFallback] = React.useState(false);
  const Fallback = FALLBACKS[type];

  if (customIconUrl) {
    return (
      <img
        src={customIconUrl}
        width={size}
        height={size}
        style={{ objectFit: 'contain' }}
        alt=""
      />
    );
  }

  // Some self-hosted types require auth even for /favicon.ico — never attempt a
  // live browser fetch for these, it produces 401/404 console errors.
  const AUTH_GATED = new Set(['adguardhome', 'homeassistant', 'proxmox', 'portainer', 'immich', 'syncthing', 'unraid', 'jellyfin']);
  const PRIVATE_HOST = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|fe80:)/i;
  const isPublicUrl = (u) => { try { const h = new URL(u).hostname; return h.includes('.') && !PRIVATE_HOST.test(h); } catch { return false; } };
  const faviconSrc = (() => {
    if (faviconUrl && isPublicUrl(faviconUrl)) return faviconUrl;
    if (AUTH_GATED.has(type)) return null;
    for (const base of [serviceUrl, url]) {
      if (!base) continue;
      try {
        const origin = new URL(base).origin;
        if (isPublicUrl(origin)) return `${origin}/favicon.ico`;
      } catch {}
    }
    return null;
  })();

  if (useFavicon && faviconSrc) {
    return (
      <FaviconIcon
        url={faviconSrc}
        size={size}
        onError={() => setUseFavicon(false)}
      />
    );
  }

  // Types that have a real file in /icons/ — always go through FileIcon first.
  const HAS_FILE_ICON = new Set(['hms', 'ultracc', 'unraid', 'docker', 'speedtest', 'openwebui', 'prowlarr', 'overseerr', 'autobrr']);
  // Icons that are black and need inversion in dark mode
  const INVERT_IN_DARK = new Set(['openwebui']);
  // For all other types with a Fallback and no favicon, skip the broken-image
  // flicker from FileIcon and render the Fallback directly.
  if (Fallback && !faviconSrc && !HAS_FILE_ICON.has(type)) return <Fallback size={size} />;

  if (!useFallback) {
    return (
      <FileIcon
        type={type}
        size={size}
        onError={() => Fallback ? setUseFallback(true) : null}
        className={INVERT_IN_DARK.has(type) ? 'icon-theme-adapt' : undefined}
      />
    );
  }

  if (!Fallback) return null;
  return <Fallback size={size} />;
}
