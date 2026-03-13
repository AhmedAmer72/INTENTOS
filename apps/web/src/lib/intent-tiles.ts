import { TARGET_CHAIN_ID, targetShortName } from "@/lib/chains";

function svg(markup: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup.trim())}`;
}

let tileSeq = 0;

function frame(inner: string, accent = "#E8D4FF") {
  const id = `t${tileSeq++}`;
  return svg(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 400 400" fill="none">
  <defs>
    <linearGradient id="${id}-g" x1="0" y1="0" x2="400" y2="400" gradientUnits="userSpaceOnUse">
      <stop stop-color="#A35EE8"/>
      <stop offset="1" stop-color="#6E28BE"/>
    </linearGradient>
    <radialGradient id="${id}-glow" cx="28%" cy="8%" r="70%">
      <stop stop-color="#D4A8FF" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(#${id}-g)"/>
  <rect width="400" height="400" fill="url(#${id}-glow)"/>
  <rect x="18" y="18" width="364" height="364" rx="28" stroke="${accent}" stroke-opacity="0.42"/>
  ${inner}
</svg>`);
}

export const INTENT_TILES = [
  frame(`
    <text x="44" y="72" fill="#F3E8FF" font-family="Inter,sans-serif" font-size="13" font-weight="600">INTENT</text>
    <text x="44" y="124" fill="#F8F0FF" font-family="Inter,sans-serif" font-size="28" font-weight="700">Write what</text>
    <text x="44" y="160" fill="#F8F0FF" font-family="Inter,sans-serif" font-size="28" font-weight="700">must stay true</text>
    <rect x="44" y="196" width="312" height="88" rx="16" fill="#6B28B4" fill-opacity="0.55" stroke="#F3E8FF" stroke-opacity="0.22"/>
    <text x="60" y="234" fill="#EDE0F8" font-family="Inter,sans-serif" font-size="13">Deploy $5,000 USDC · 14 days</text>
    <text x="60" y="258" fill="#EDE0F8" font-family="Inter,sans-serif" font-size="13">No leverage. Low risk only.</text>
    <rect x="44" y="308" width="122" height="28" rx="14" fill="#F3E8FF" fill-opacity="0.16" stroke="#F3E8FF" stroke-opacity="0.4"/>
    <text x="58" y="327" fill="#F8F0FF" font-family="Inter,sans-serif" font-size="11">HARD · 14d</text>
  `),
  frame(
    `
    <text x="44" y="72" fill="#FECDD3" font-family="Inter,sans-serif" font-size="13" font-weight="600">SETTLEMENT GATE</text>
    <g transform="translate(88 128) rotate(-8)">
      <rect x="0" y="0" width="220" height="96" rx="22" stroke="#FECDD3" stroke-width="4"/>
      <text x="110" y="62" text-anchor="middle" fill="#FECDD3" font-family="Instrument Serif,serif" font-size="42" font-style="italic">REJECT</text>
    </g>
    <text x="44" y="300" fill="#EDE0F8" font-family="ui-monospace,monospace" font-size="12">DemoVault.deposit</text>
    <text x="44" y="326" fill="#F8F0FF" font-family="ui-monospace,monospace" font-size="13">IntentNotApproved</text>
  `,
    "#FECDD3",
  ),
  frame(`
    <text x="44" y="72" fill="#F3E8FF" font-family="Inter,sans-serif" font-size="13" font-weight="600">VERDICT</text>
    <g transform="translate(78 128) rotate(-8)">
      <rect x="0" y="0" width="244" height="96" rx="22" stroke="#F3E8FF" stroke-width="4"/>
      <text x="122" y="62" text-anchor="middle" fill="#F8F0FF" font-family="Instrument Serif,serif" font-size="38" font-style="italic">APPROVE</text>
    </g>
    <text x="44" y="300" fill="#EDE0F8" font-family="Inter,sans-serif" font-size="14">Alignment 94.2%</text>
    <text x="44" y="328" fill="#F8F0FF" font-family="Inter,sans-serif" font-size="14">Ready to settle</text>
  `),
  frame(`
    <text x="44" y="72" fill="#F3E8FF" font-family="Inter,sans-serif" font-size="13" font-weight="600">ENVELOPE</text>
    <path d="M56 140h288v160H56z" stroke="#F3E8FF" stroke-opacity="0.55" stroke-width="2"/>
    <path d="M56 140l144 88 144-88" stroke="#F3E8FF" stroke-width="2"/>
    <text x="200" y="248" text-anchor="middle" fill="#F8F0FF" font-family="Inter,sans-serif" font-size="16" font-weight="600">keccak(intent)</text>
    <text x="44" y="340" fill="#EDE0F8" font-family="ui-monospace,monospace" font-size="12">0x7a1c…e4f2</text>
  `),
  frame(`
    <text x="44" y="72" fill="#F3E8FF" font-family="Inter,sans-serif" font-size="13" font-weight="600">LAYER 1</text>
    <text x="44" y="130" fill="#F8F0FF" font-family="Inter,sans-serif" font-size="26" font-weight="700">Rules first.</text>
    <text x="44" y="166" fill="#EDE0F8" font-family="Inter,sans-serif" font-size="15">Hard FAIL is terminal.</text>
    <rect x="44" y="206" width="312" height="48" rx="12" fill="#6B28B4" fill-opacity="0.55" stroke="#F3E8FF" stroke-opacity="0.2"/>
    <text x="60" y="236" fill="#FECDD3" font-family="Inter,sans-serif" font-size="14">leverage  ≤  1.0   FAIL</text>
    <rect x="44" y="266" width="312" height="48" rx="12" fill="#6B28B4" fill-opacity="0.55" stroke="#F3E8FF" stroke-opacity="0.2"/>
    <text x="60" y="296" fill="#F3E8FF" font-family="Inter,sans-serif" font-size="14">duration  =  14d   PASS</text>
  `),
  frame(`
    <text x="44" y="72" fill="#F3E8FF" font-family="Inter,sans-serif" font-size="13" font-weight="600">0G COMPUTE</text>
    <circle cx="200" cy="196" r="78" stroke="#F3E8FF" stroke-opacity="0.4" stroke-width="2"/>
    <circle cx="200" cy="196" r="42" fill="#F3E8FF" fill-opacity="0.16" stroke="#F3E8FF"/>
    <text x="200" y="202" text-anchor="middle" fill="#F8F0FF" font-family="Inter,sans-serif" font-size="14" font-weight="600">TEE</text>
    <text x="44" y="330" fill="#EDE0F8" font-family="Inter,sans-serif" font-size="14">qwen2.5-omni · attested</text>
  `),
  frame(`
    <text x="44" y="72" fill="#F3E8FF" font-family="Inter,sans-serif" font-size="13" font-weight="600">0G STORAGE</text>
    <path d="M200 110l110 52v84l-110 52-110-52v-84z" stroke="#F3E8FF" stroke-width="2"/>
    <path d="M90 162l110 52 110-52" stroke="#F3E8FF" stroke-opacity="0.5"/>
    <text x="200" y="198" text-anchor="middle" fill="#F8F0FF" font-family="Inter,sans-serif" font-size="13">merkle root</text>
    <text x="44" y="336" fill="#EDE0F8" font-family="ui-monospace,monospace" font-size="12">evidence uploaded</text>
  `),
  frame(`
    <text x="44" y="72" fill="#F3E8FF" font-family="Inter,sans-serif" font-size="13" font-weight="600">EIP-712</text>
    <text x="44" y="128" fill="#F8F0FF" font-family="Inter,sans-serif" font-size="26" font-weight="700">Sign the hash.</text>
    <text x="44" y="164" fill="#EDE0F8" font-family="Inter,sans-serif" font-size="14">Only keccak goes on-chain.</text>
    <rect x="44" y="206" width="312" height="120" rx="16" fill="#6B28B4" fill-opacity="0.55" stroke="#F3E8FF" stroke-opacity="0.28"/>
    <text x="64" y="246" fill="#EDE0F8" font-family="ui-monospace,monospace" font-size="12">registerIntent</text>
    <text x="64" y="276" fill="#F8F0FF" font-family="ui-monospace,monospace" font-size="13">0xF011…530b</text>
    <text x="64" y="304" fill="#F3E8FF" font-family="Inter,sans-serif" font-size="12">${targetShortName} · ${TARGET_CHAIN_ID}</text>
  `),
  frame(
    `
    <text x="44" y="72" fill="#F3E8FF" font-family="Inter,sans-serif" font-size="13" font-weight="600">THE GATE</text>
    <rect x="120" y="108" width="160" height="200" rx="12" stroke="#F3E8FF" stroke-opacity="0.28"/>
    <rect x="148" y="150" width="104" height="116" rx="8" stroke="#F3E8FF" stroke-width="2"/>
    <circle cx="200" cy="208" r="14" stroke="#F3E8FF" stroke-width="2"/>
    <path d="M200 222v28" stroke="#F3E8FF" stroke-width="2"/>
    <text x="200" y="348" text-anchor="middle" fill="#EDE0F8" font-family="Inter,sans-serif" font-size="13">isApproved == false</text>
  `,
    "#E8D4FF",
  ),
  frame(`
    <text x="44" y="72" fill="#F3E8FF" font-family="Inter,sans-serif" font-size="13" font-weight="600">CERTIFICATE</text>
    <text x="44" y="130" fill="#F8F0FF" font-family="Inter,sans-serif" font-size="26" font-weight="700">Public proof</text>
    <rect x="44" y="168" width="312" height="56" rx="12" fill="#6B28B4" fill-opacity="0.55" stroke="#F3E8FF" stroke-opacity="0.2"/>
    <text x="60" y="202" fill="#EDE0F8" font-family="ui-monospace,monospace" font-size="12">contentHash  0x91ab…</text>
    <rect x="44" y="236" width="312" height="56" rx="12" fill="#6B28B4" fill-opacity="0.55" stroke="#F3E8FF" stroke-opacity="0.2"/>
    <text x="60" y="270" fill="#EDE0F8" font-family="ui-monospace,monospace" font-size="12">storageRoot  0x44e0…</text>
    <text x="44" y="336" fill="#F3E8FF" font-family="Inter,sans-serif" font-size="13">Anyone can re-hash it.</text>
  `),
];
