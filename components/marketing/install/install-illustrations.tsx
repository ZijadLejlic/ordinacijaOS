import { BRAND_COLORS } from "@/lib/brand/constants";
import type { InstallPlatform } from "@/lib/marketing/install";
import { cn } from "@/lib/utils";

type IllustrationProps = {
  platform: InstallPlatform;
  step: number;
  caption: string;
  className?: string;
};

/** Stylized UI mocks — not real OS screenshots (those go stale). */
export function InstallStepIllustration({
  platform,
  step,
  caption,
  className,
}: IllustrationProps) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--marketing-ink)_8%,transparent)] bg-[var(--marketing-mist)]",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full p-4 md:p-5">
        <svg
          viewBox="0 0 360 225"
          className="h-full w-full"
          role="img"
          aria-label={caption}
        >
          <rect width={360} height={225} rx={12} fill={BRAND_COLORS.wash} />
          {platform === "android" && <AndroidSteps step={step} />}
          {platform === "ios" && <IosSteps step={step} />}
          {platform === "windows" && <DesktopSteps step={step} os="windows" />}
          {platform === "mac" && <DesktopSteps step={step} os="mac" />}
        </svg>
      </div>
      <figcaption className="border-t border-[color-mix(in_oklab,var(--marketing-ink)_6%,transparent)] bg-[var(--marketing-surface)] px-4 py-3 text-sm leading-snug text-[color-mix(in_oklab,var(--marketing-ink)_70%,transparent)]">
        {caption}
      </figcaption>
    </figure>
  );
}

function PhoneChrome({ children }: { children: React.ReactNode }) {
  return (
    <g>
      <rect
        x={108}
        y={12}
        width={144}
        height={200}
        rx={18}
        fill={BRAND_COLORS.navy}
      />
      <rect x={114} y={28} width={132} height={172} rx={10} fill="#fff" />
      <rect x={162} y={18} width={36} height={6} rx={3} fill="#1a2a4a" />
      {children}
    </g>
  );
}

function Highlight({
  x,
  y,
  w,
  h,
  label,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        fill={BRAND_COLORS.blue}
        opacity={0.12}
        stroke={BRAND_COLORS.blue}
        strokeWidth={2}
      />
      {label ? (
        <text
          x={x + w / 2}
          y={y + h / 2 + 4}
          textAnchor="middle"
          fontSize={11}
          fontFamily="system-ui, sans-serif"
          fill={BRAND_COLORS.blueDeep}
          fontWeight={600}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

function AndroidSteps({ step }: { step: number }) {
  return (
    <PhoneChrome>
      {step === 1 && (
        <>
          <rect x={124} y={40} width={112} height={14} rx={4} fill="#E8F4FF" />
          <text
            x={180}
            y={51}
            textAnchor="middle"
            fontSize={9}
            fill={BRAND_COLORS.navy}
            fontFamily="system-ui, sans-serif"
          >
            dentord.com
          </text>
          <Highlight x={228} y={38} w={14} h={18} label="⋮" />
        </>
      )}
      {step === 2 && (
        <>
          <rect x={128} y={48} width={104} height={120} rx={8} fill="#F5FAFF" />
          <Highlight x={136} y={58} w={88} h={22} label="Install app" />
          <rect x={140} y={90} width={80} height={8} rx={2} fill="#DDE8F5" />
          <rect x={140} y={106} width={64} height={8} rx={2} fill="#DDE8F5" />
        </>
      )}
      {step === 3 && (
        <>
          <rect x={128} y={70} width={104} height={90} rx={10} fill="#fff" />
          <circle cx={180} cy={100} r={18} fill={BRAND_COLORS.blue} />
          <text
            x={180}
            y={132}
            textAnchor="middle"
            fontSize={10}
            fill={BRAND_COLORS.navy}
            fontFamily="system-ui, sans-serif"
            fontWeight={600}
          >
            DentOrd
          </text>
          <Highlight x={148} y={142} w={64} h={20} label="Install" />
        </>
      )}
      {step === 4 && (
        <>
          <rect
            x={128}
            y={48}
            width={40}
            height={40}
            rx={10}
            fill={BRAND_COLORS.blue}
          />
          <text
            x={148}
            y={72}
            textAnchor="middle"
            fontSize={12}
            fill="#fff"
            fontFamily="system-ui, sans-serif"
            fontWeight={700}
          >
            D
          </text>
          <text
            x={148}
            y={102}
            textAnchor="middle"
            fontSize={9}
            fill={BRAND_COLORS.navy}
            fontFamily="system-ui, sans-serif"
          >
            DentOrd
          </text>
          <Highlight x={124} y={44} w={48} h={66} label="" />
        </>
      )}
    </PhoneChrome>
  );
}

function IosSteps({ step }: { step: number }) {
  return (
    <PhoneChrome>
      {step === 1 && (
        <>
          <rect x={124} y={40} width={112} height={14} rx={4} fill="#E8F4FF" />
          <text
            x={180}
            y={51}
            textAnchor="middle"
            fontSize={9}
            fill={BRAND_COLORS.navy}
            fontFamily="system-ui, sans-serif"
          >
            dentord.com
          </text>
          <Highlight x={168} y={178} w={24} h={16} label="↑" />
        </>
      )}
      {step === 2 && (
        <>
          <rect x={124} y={100} width={112} height={90} rx={12} fill="#F5FAFF" />
          <Highlight x={132} y={112} w={96} h={24} label="Add to Home" />
          <rect x={140} y={148} width={80} height={8} rx={2} fill="#DDE8F5" />
          <rect x={140} y={164} width={64} height={8} rx={2} fill="#DDE8F5" />
        </>
      )}
      {step === 3 && (
        <>
          <rect x={128} y={56} width={104} height={100} rx={10} fill="#fff" />
          <circle cx={180} cy={90} r={16} fill={BRAND_COLORS.blue} />
          <text
            x={180}
            y={118}
            textAnchor="middle"
            fontSize={10}
            fill={BRAND_COLORS.navy}
            fontFamily="system-ui, sans-serif"
            fontWeight={600}
          >
            DentOrd
          </text>
          <Highlight x={200} y={40} w={36} h={18} label="Add" />
        </>
      )}
      {step === 4 && (
        <>
          <rect
            x={128}
            y={48}
            width={40}
            height={40}
            rx={10}
            fill={BRAND_COLORS.blue}
          />
          <text
            x={148}
            y={72}
            textAnchor="middle"
            fontSize={12}
            fill="#fff"
            fontFamily="system-ui, sans-serif"
            fontWeight={700}
          >
            D
          </text>
          <text
            x={148}
            y={102}
            textAnchor="middle"
            fontSize={9}
            fill={BRAND_COLORS.navy}
            fontFamily="system-ui, sans-serif"
          >
            DentOrd
          </text>
          <Highlight x={124} y={44} w={48} h={66} label="" />
        </>
      )}
    </PhoneChrome>
  );
}

function DesktopSteps({
  step,
  os,
}: {
  step: number;
  os: "windows" | "mac";
}) {
  const title = os === "mac" ? "Chrome · Mac" : "Chrome · Windows";
  return (
    <g>
      <rect
        x={28}
        y={28}
        width={304}
        height={168}
        rx={10}
        fill={BRAND_COLORS.navy}
      />
      <rect x={34} y={48} width={292} height={140} rx={6} fill="#fff" />
      <circle cx={48} cy={38} r={3} fill="#FF5F57" />
      <circle cx={60} cy={38} r={3} fill="#FEBC2E" />
      <circle cx={72} cy={38} r={3} fill="#28C840" />
      <text
        x={180}
        y={42}
        textAnchor="middle"
        fontSize={9}
        fill="#9ab"
        fontFamily="system-ui, sans-serif"
      >
        {title}
      </text>
      {step === 1 && (
        <>
          <rect x={48} y={60} width={200} height={16} rx={4} fill="#E8F4FF" />
          <text
            x={58}
            y={72}
            fontSize={9}
            fill={BRAND_COLORS.navy}
            fontFamily="system-ui, sans-serif"
          >
            dentord.com
          </text>
          <Highlight x={268} y={58} w={44} h={20} label="⊕" />
        </>
      )}
      {step === 2 && (
        <>
          <rect x={200} y={70} width={110} height={80} rx={8} fill="#F5FAFF" />
          <Highlight x={208} y={80} w={94} h={22} label="Install" />
          <rect x={214} y={112} width={70} height={8} rx={2} fill="#DDE8F5" />
          <rect x={214} y={128} width={56} height={8} rx={2} fill="#DDE8F5" />
        </>
      )}
      {step === 3 && (
        <>
          <rect
            x={48}
            y={70}
            width={48}
            height={48}
            rx={10}
            fill={BRAND_COLORS.blue}
          />
          <text
            x={72}
            y={100}
            textAnchor="middle"
            fontSize={16}
            fill="#fff"
            fontFamily="system-ui, sans-serif"
            fontWeight={700}
          >
            D
          </text>
          <text
            x={72}
            y={136}
            textAnchor="middle"
            fontSize={10}
            fill={BRAND_COLORS.navy}
            fontFamily="system-ui, sans-serif"
          >
            DentOrd
          </text>
          <Highlight x={44} y={66} w={56} h={80} label="" />
        </>
      )}
    </g>
  );
}
