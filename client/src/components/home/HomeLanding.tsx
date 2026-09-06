import { useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Compass,
  CreditCard,
  Info,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "./homepage.css";

const IMAGES = {
  hero: "https://d2xsxph8kpxj0f.cloudfront.net/310519663447477902/GxpY3fEmfUKNJ8D35WAotv/hero_forest_compass-TpNT9AJSiba9J2yScBLeno.webp",
  mapping:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663447477902/GxpY3fEmfUKNJ8D35WAotv/mind_map-J5ryK6r88v2N6nu2vv4AiN.webp",
  report:
    "https://d2xsxph8kpxj0f.cloudfront.net/310519663447477902/GxpY3fEmfUKNJ8D35WAotv/professional_analysis-HUzJDk8v8cedaaHKLv9kuc.webp",
};

// Keep the original photography. These illustrations also keep the page useful
// when the existing image host is unavailable; they contain no sample results.
function OriginalImage({
  src,
  alt,
  children,
  eager = false,
}: {
  src: string;
  alt: string;
  children: ReactNode;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="mc-original-image" data-image-failed={failed || undefined}>
      <div className="mc-image-fallback" aria-hidden={!failed}>
        {children}
      </div>
      <img
        src={src}
        alt={alt}
        aria-hidden={failed || undefined}
        hidden={failed}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function CompassIllustration() {
  const point = (type: number, radius: number) => {
    const angle = (((type % 9) * 40 - 90) * Math.PI) / 180;
    return {
      x: 280 + Math.cos(angle) * radius,
      y: 280 + Math.sin(angle) * radius,
    };
  };
  const polygon = (types: number[]) =>
    types
      .map(type => {
        const p = point(type, 170);
        return `${p.x},${p.y}`;
      })
      .join(" ");
  return (
    <svg
      viewBox="0 0 560 560"
      className="mc-compass-art"
      role="img"
      aria-label="아홉 가지 성격 유형의 연결을 표현한 나침반 일러스트"
    >
      <circle cx="280" cy="288" r="250" fill="#102e27" fillOpacity=".25" />
      <circle cx="280" cy="280" r="249" fill="#c5b48f" />
      <circle cx="280" cy="280" r="242" fill="#f1eee2" />
      <circle
        cx="280"
        cy="280"
        r="234"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".12"
      />
      <circle
        cx="280"
        cy="280"
        r="219"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".12"
      />
      {Array.from({ length: 90 }, (_, i) => (
        <line
          key={i}
          x1="280"
          y1="47"
          x2="280"
          y2={i % 5 === 0 ? 57 : 52}
          stroke="currentColor"
          strokeOpacity={i % 5 === 0 ? ".5" : ".25"}
          transform={`rotate(${i * 4} 280 280)`}
        />
      ))}
      <circle
        cx="280"
        cy="280"
        r="170"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".45"
      />
      <polygon
        points={polygon([9, 3, 6])}
        fill="none"
        stroke="currentColor"
        strokeOpacity=".5"
        strokeWidth="1.2"
      />
      <polygon
        points={polygon([1, 4, 2, 8, 5, 7])}
        fill="none"
        stroke="currentColor"
        strokeOpacity=".3"
        strokeWidth="1.2"
      />
      <circle
        cx="280"
        cy="280"
        r="105"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".12"
        strokeDasharray="2 5"
      />
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(type => {
        const p = point(type, 170);
        const label = point(type, 196);
        return (
          <g key={type}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill={type === 9 ? "#af6447" : "currentColor"}
            />
            <text
              x={label.x}
              y={label.y}
              dy=".35em"
              textAnchor="middle"
              fill="currentColor"
              fontSize="18"
              fontFamily="Georgia, serif"
            >
              {type}
            </text>
          </g>
        );
      })}
      <g transform="rotate(28 280 280)">
        <path d="M280 145 L297 280 L280 311 Z" fill="#244d42" />
        <path d="M280 145 L263 280 L280 311 Z" fill="#769487" />
        <path d="M280 415 L263 280 L280 249 Z" fill="#af6447" />
        <path d="M280 415 L297 280 L280 249 Z" fill="#c39b7e" />
      </g>
      <circle
        cx="280"
        cy="280"
        r="10"
        fill="#f1f1e8"
        stroke="#244d42"
        strokeWidth="2"
      />
      <circle cx="280" cy="280" r="3" fill="#244d42" />
      <path
        d="M20 280h15m490 0h15M280 20v15m0 490v15"
        stroke="currentColor"
        strokeOpacity=".5"
      />
    </svg>
  );
}

function MappingIllustration() {
  return (
    <div
      className="mc-mapping-art"
      role="img"
      aria-label="머리, 가슴, 장의 세 가지 중심 에너지 분석 구조"
    >
      <span className="mc-art-caption">THREE CENTERS OF INTELLIGENCE</span>
      <svg viewBox="0 0 460 280" aria-hidden="true">
        <g fill="none" stroke="#a8b2a3" strokeWidth=".7">
          <path d="M36 140h60m268 0h60M230 8v16M230 264v12" />
          <circle cx="230" cy="146" r="128" strokeDasharray="2 6" />
          <path d="M30 131v18m400-18v18" />
        </g>
        <circle cx="230" cy="103" r="78" fill="#244d42" stroke="#163c31" />
        <circle
          cx="178"
          cy="185"
          r="78"
          fill="#cfb695"
          fillOpacity=".9"
          stroke="#a08a68"
        />
        <circle
          cx="282"
          cy="185"
          r="78"
          fill="#aabcaa"
          fillOpacity=".88"
          stroke="#708d75"
        />
        <g fill="#244d42" fontSize="17" textAnchor="middle">
          <text x="230" y="79" fill="#faf7eb">
            머리
          </text>
          <text
            x="230"
            y="100"
            fill="#faf7eb"
            fontFamily="Georgia, serif"
            fontSize="12"
          >
            5 · 6 · 7
          </text>
          <text x="154" y="193">
            가슴
          </text>
          <text x="154" y="215" fontFamily="Georgia, serif" fontSize="12">
            2 · 3 · 4
          </text>
          <text x="305" y="193">
            장
          </text>
          <text x="305" y="215" fontFamily="Georgia, serif" fontSize="12">
            8 · 9 · 1
          </text>
        </g>
        <circle cx="230" cy="158" r="5" fill="#244d42" />
      </svg>
    </div>
  );
}

function ReportIllustration() {
  return (
    <div
      className="mc-report-art"
      role="img"
      aria-label="주 유형과 인접한 두 날개의 상호작용을 표현한 프로파일 일러스트"
    >
      <div className="mc-report-sheet">
        <div className="mc-report-sheet-top">
          <Compass size={18} />
          <span>MIND COMPASS LAB</span>
        </div>
        <p>
          나의 성향을,
          <br />
          <strong>더 입체적으로.</strong>
        </p>
        <span className="mc-report-eyebrow">ENNEAGRAM & WING</span>
        <div className="mc-wing-diagram">
          <span>날개</span>
          <i />
          <strong>주 유형</strong>
          <i />
          <span>날개</span>
        </div>
        <div className="mc-report-lines">
          <span />
          <span />
          <span />
        </div>
        <div className="mc-report-sheet-bottom">
          <span>PERSONALITY PROFILE</span>
          <span>01 — 09</span>
        </div>
      </div>
    </div>
  );
}

export function LandingHeader() {
  return (
    <header className="mc-header">
      <a className="mc-skip" href="#home-main">
        본문으로 바로가기
      </a>
      <div className="mc-shell mc-header-inner">
        <a
          href="#home-main"
          className="mc-brand"
          aria-label="마음나침반연구소 홈"
        >
          <Compass className="mc-brand-mark" strokeWidth={1.3} />
          <span>
            <strong>마음나침반연구소</strong>
            <small>Mind Compass Lab</small>
          </span>
        </a>
        <nav className="mc-nav" aria-label="홈페이지 섹션">
          <a href="#about">검사 소개</a>
          <a href="#analysis">분석 리포트</a>
          <a href="#process">진행 안내</a>
        </nav>
        <a className="mc-header-cta" href="#start">
          검사 시작하기 <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="mc-footer">
      <div className="mc-shell mc-footer-inner">
        <div>
          <a href="#home-main" className="mc-brand">
            <Compass className="mc-brand-mark" strokeWidth={1.3} />
            <span>
              <strong>마음나침반연구소</strong>
              <small>Mind Compass Lab</small>
            </span>
          </a>
          <p className="mc-copyright">
            © 2026 마음나침반연구소 All Rights Reserved.
          </p>
        </div>
        <p className="mc-disclaimer">
          본 테스트는 애니어그램 학술적 이론에 기반하여 마음나침반연구소에서
          MZ세대 성향에 맞춰 새롭게 재구성한 약식 테스트입니다. 정밀 상담 및
          임상 분석 대용으로 사용될 수 없습니다.
        </p>
      </div>
    </footer>
  );
}

interface HomeLandingProps {
  isFreeAccess: boolean;
  isPromoExpanded: boolean;
  promoCode: string;
  onPromoToggle: () => void;
  onPromoChange: (value: string) => void;
  onStart: () => void;
}

export default function HomeLanding({
  isFreeAccess,
  isPromoExpanded,
  promoCode,
  onPromoToggle,
  onPromoChange,
  onStart,
}: HomeLandingProps) {
  return (
    <div className="mc-landing-content">
      <section className="mc-shell mc-hero" aria-labelledby="home-title">
        <div className="mc-hero-copy">
          <p className="mc-eyebrow">
            <span className="mc-status-dot" /> 정밀 성격 진단 솔루션
          </p>
          <h1 id="home-title">
            나의 진짜 본질과
            <br />
            잠재력을 깨우는
            <br />
            <em>정밀 애니어그램 검사</em>
          </h1>
          <p className="mc-hero-description">
            단순한 1차원적 성격 분류를 넘어, 심리학적 동기와 방어기제, 그리고{" "}
            <strong>날개(Wing) 상호작용</strong>까지 반영한 국내에서 가장 정밀한
            정적 애니어그램 검사입니다.
          </p>
          <div className="mc-hero-actions">
            <a href="#start" className="mc-primary-link">
              나의 검사 시작하기 <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <span>
              81문항 <i /> 약 10~15분
            </span>
          </div>
          <a className="mc-text-link" href="#about">
            내 마음의 방향을 알아보세요{" "}
            <ArrowDown size={15} aria-hidden="true" />
          </a>
        </div>
        <figure className="mc-hero-figure">
          <OriginalImage
            src={IMAGES.hero}
            alt="마음나침반연구소 숲속 나침반"
            eager
          >
            <div className="mc-hero-art">
              <div className="mc-art-topline">
                <span>THE INNER COMPASS</span>
                <span>VOL. 01</span>
              </div>
              <CompassIllustration />
              <div className="mc-art-bottomline">
                <span>아홉 가지 성향, 하나의 나.</span>
                <span>
                  ENNEAGRAM
                  <br />
                  PERSONALITY STUDY
                </span>
              </div>
            </div>
          </OriginalImage>
          <figcaption>
            <span>나를 향한 탐색의 시작</span>
            <span>01 / SELF-DISCOVERY</span>
          </figcaption>
        </figure>
      </section>

      <section id="about" className="mc-about" aria-labelledby="about-title">
        <div className="mc-shell">
          <div className="mc-section-heading">
            <p className="mc-eyebrow">
              01 <span /> ABOUT THE TEST
            </p>
            <h2 id="about-title">
              성격 너머의 나를
              <br />
              이해하는 시간.
            </h2>
            <p className="mc-about-description">
              마음나침반연구소의 전문 연구진이 설계한 본 진단은 스스로도
              알아채지 못했던 내면의 핵심 공포와 욕구를 파헤치고, 보다 균형 잡힌
              삶을 살아갈 수 있도록 명확한 방향을 제안합니다.
            </p>
          </div>
        </div>
        <div className="mc-metrics-band">
          <dl className="mc-shell mc-metrics">
            <div>
              <dt>정밀 리커트 척도</dt>
              <dd>
                81<span>문항</span>
              </dd>
            </div>
            <div>
              <dt>주유형 & 날개 조합</dt>
              <dd>
                18<span>개</span>
              </dd>
            </div>
            <div>
              <dt>알고리즘 매칭 신뢰도</dt>
              <dd>
                99.4<span>%</span>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        id="analysis"
        className="mc-analysis"
        aria-labelledby="analysis-title"
      >
        <div className="mc-shell mc-section-heading">
          <p className="mc-eyebrow">
            02 <span /> A DEEPER UNDERSTANDING
          </p>
          <h2 id="analysis-title">
            하나의 유형보다, <br />
            입체적인 당신을 위해.
          </h2>
        </div>
        <div className="mc-analysis-grid">
          <article className="mc-shell mc-feature mc-feature-mapping">
            <div className="mc-feature-visual">
              <OriginalImage src={IMAGES.mapping} alt="마음나침반 분석 구조">
                <MappingIllustration />
              </OriginalImage>
            </div>
            <div className="mc-feature-copy">
              <span className="mc-feature-number">01</span>
              <div>
                <h3>다차원 심리 매핑</h3>
                <p>
                  머리(5,6,7), 가슴(2,3,4), 장(8,9,1) 세 가지 중심 에너지를
                  기반으로 개인의 인지적, 감정적, 신체적 반응 패턴을 종합
                  분석합니다.
                </p>
              </div>
            </div>
          </article>
          <article className="mc-feature mc-feature-report">
            <div className="mc-shell mc-report-layout">
              <div className="mc-feature-visual">
                <OriginalImage src={IMAGES.report} alt="전문가 해설지 제공">
                  <ReportIllustration />
                </OriginalImage>
              </div>
              <div className="mc-feature-copy">
                <span className="mc-feature-number">02</span>
                <div>
                  <h3>날개(Wing) 정밀 프로파일</h3>
                  <p>
                    단순히 한 가지 성격으로만 규정하지 않습니다. 본인의 잠재의식
                    속에서 보조 역할을 수행하는 날개 성향을 판별하여 입체적인
                    프로필을 제공합니다.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        id="process"
        className="mc-process"
        aria-labelledby="process-title"
      >
        <div className="mc-shell mc-process-layout">
          <div className="mc-section-heading">
            <p className="mc-eyebrow">
              03 <span /> YOUR JOURNEY
            </p>
            <h2 id="process-title">검사 진행 프로세스</h2>
            <p className="mc-process-note">나를 만나는 네 번의 걸음.</p>
          </div>
          <ol className="mc-process-list">
            {[
              {
                step: "01",
                title: "결제 및 코드적용",
                desc: "간편결제 또는 프로모션 코드",
              },
              {
                step: "02",
                title: "인적사항 기재",
                desc: "생년월일 및 닉네임 입력",
              },
              { step: "03", title: "81문항 자가진단", desc: "약 10~15분 소요" },
              {
                step: "04",
                title: "마음 처방전 수령",
                desc: "맞춤형 리포트 분석",
              },
            ].map(item => (
              <li key={item.step}>
                <span className="mc-step-number">{item.step}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
                <ArrowDown size={17} aria-hidden="true" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="start" className="mc-start" aria-labelledby="start-title">
        <div className="mc-shell mc-start-layout">
          <div className="mc-start-copy">
            <p className="mc-eyebrow">
              04 <span /> BEGIN WITH YOURSELF
            </p>
            <h2>
              이제, 당신의
              <br />
              마음이 향하는 곳으로.
            </h2>
            <p>정밀 심리 검사 및 해설지 제공</p>
          </div>
          <div className="mc-offer">
            <div className="mc-offer-topline">
              <span>SPECIAL OFFER</span>
              <ArrowUpRight size={20} aria-hidden="true" />
            </div>
            <h3 id="start-title">애니어그램 1회 검사 + 결과 리포트</h3>
            <p className="mc-offer-description">
              나의 무의식 공포, 욕구, 스트레스 대처법, 어울리는 MBTI 매칭 정보
              포함
            </p>
            <div className="mc-price">
              <span>정가 79,000원</span>
              <strong>
                49,000<small>원</small>
              </strong>
            </div>
            <Button
              onClick={onStart}
              className="mc-start-button"
              id="homepage-start-button"
            >
              {isFreeAccess ? (
                <>
                  <Sparkles aria-hidden="true" />
                  무료 혜택으로 검사 시작하기
                </>
              ) : (
                <>
                  <CreditCard aria-hidden="true" />
                  49,000원 결제하고 검사 시작하기
                </>
              )}
              <ArrowRight aria-hidden="true" />
            </Button>
            <div className="mc-promo">
              <button
                type="button"
                aria-expanded={isPromoExpanded}
                aria-controls="homepage-promo-panel"
                onClick={onPromoToggle}
                className="mc-promo-toggle"
              >
                <span>추천인 / 제휴 프로모션 코드가 있으신가요?</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              <div
                id="homepage-promo-panel"
                hidden={!isPromoExpanded}
                className="mc-promo-panel"
              >
                <label htmlFor="homepage-promo-code">
                  <Sparkles size={15} aria-hidden="true" /> 제휴 파트너 코드
                  적용
                </label>
                <p>
                  파트너십 제휴 기관의 추천인 코드나 무료 QR 코드를 소지하고
                  계신가요? 코드를 입력하시면 <strong>전액 100% 무료</strong>로
                  검사를 진행할 수 있습니다.
                </p>
                <div className="mc-promo-input">
                  <Input
                    id="homepage-promo-code"
                    type="text"
                    autoComplete="off"
                    placeholder="추천인 코드를 입력하세요"
                    value={promoCode}
                    onChange={event => onPromoChange(event.target.value)}
                    aria-describedby="homepage-promo-status"
                  />
                  <span
                    id="homepage-promo-status"
                    role="status"
                    className={
                      isFreeAccess ? "mc-code-valid" : "mc-code-invalid"
                    }
                  >
                    {promoCode &&
                      (isFreeAccess ? (
                        <>
                          <Check size={14} aria-hidden="true" /> 적용됨
                        </>
                      ) : (
                        <>
                          <Info size={14} aria-hidden="true" /> 미승인
                        </>
                      ))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
