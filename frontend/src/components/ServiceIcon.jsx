import React from 'react';
import { siCloudflare, siAdguard, siSyncthing, siProxmox, siImmich, siPortainer } from 'simple-icons';
import { Globe, Activity, Terminal } from 'lucide-react';

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
  adguard:    ({ size }) => <SimpleIcon icon={siAdguard}    size={size} />,
  syncthing:  ({ size }) => <SimpleIcon icon={siSyncthing}  size={size} />,
  proxmox:    ({ size }) => <SimpleIcon icon={siProxmox}    size={size} />,
  immich:     ({ size }) => <SimpleIcon icon={siImmich}     size={size} />,
  portainer:  ({ size }) => <SimpleIcon icon={siPortainer}  size={size} />,
  hms:        ({ size }) => <HmsIcon size={size} />,
  ultracc:    ({ size }) => <UltraccIcon size={size} />,
  http:       ({ size }) => <Globe size={size} color="#c9d7f8" />,
  ping:       ({ size }) => <Activity size={size} color="#80cfa9" />,
  ssh:        ({ size }) => <Terminal size={size} color="#a7e2e3" />,
};

function FileIcon({ type, size, onError }) {
  return (
    <img
      src={`/icons/${type}.png`}
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
      onError={onError}
      alt={type}
    />
  );
}

export default function ServiceIcon({ type, size = 20 }) {
  const [useFallback, setUseFallback] = React.useState(false);
  const Fallback = FALLBACKS[type];

  if (!Fallback) return null;

  if (!useFallback) {
    return (
      <FileIcon
        type={type}
        size={size}
        onError={() => setUseFallback(true)}
      />
    );
  }

  return <Fallback size={size} />;
}
