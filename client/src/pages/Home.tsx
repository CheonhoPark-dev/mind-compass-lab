import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Compass, 
  ChevronRight, 
  ChevronLeft, 
  ArrowRight, 
  Heart, 
  ShieldCheck, 
  Lock, 
  HelpCircle, 
  Sparkles, 
  Share2, 
  RotateCcw,
  Check,
  Award,
  BookOpen,
  TrendingUp,
  MessageCircle,
  Copy,
  Info,
  Users,
  GraduationCap,
  Activity,
  UserCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  X,
  Loader2,
  Send,
  Phone
} from "lucide-react";
import { QUESTIONS, ENNEAGRAM_TYPES, EnneagramTypeInfo } from "../lib/questions";
import { WINGS_DATA, EnneagramWingInfo } from "../lib/wings";
import { ENNEAGRAM_TYPE_REPORTS } from "../lib/typeReports";
import type { ResultSubmissionPayload } from "@shared/resultSubmissions";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

type Step = "landing" | "onboarding" | "test" | "result";
type PaymentMethod = "toss" | "kakao" | "naver" | "card";

interface UserInfo {
  name: string;
  birthDate: string; // 생년월일 8자리 (예: 19980527)
  agreePrivacy: boolean;
  promoCode: string;
}

interface CounselorShareForm {
  counselorName: string;
  respondentPhone: string;
}

interface ChartDataPoint {
  name: string;
  type: number;
  score: number;
}

export default function Home() {
  // 상태 관리
  const [step, setStep] = useState<Step>("landing");
  const [userInfo, setUserInfo] = useState<UserInfo>({
    name: "",
    birthDate: "",
    agreePrivacy: false,
    promoCode: ""
  });
  
  // 각 문항의 점수 (문항 id: 점수 1~5)
  const [answers, setAnswers] = useState<Record<number, number>>({});
  
  // 현재 풀고 있는 문항 그룹 인덱스 (한 페이지에 5문항씩 노출)
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  // 애니메이션 방향 제어용 ("next" | "prev")
  const [direction, setDirection] = useState<"next" | "prev">("next");
  
  // 프로모션 코드 입력란 아코디언(접힘) 상태 제어
  const [isPromoExpanded, setIsPromoExpanded] = useState(false);
  
  // 가상 결제 모달 팝업 상태 제어
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("toss");
  const [isPaying, setIsPaying] = useState(false);
  const [isCounselorDialogOpen, setIsCounselorDialogOpen] = useState(false);
  const [isSendingToCounselor, setIsSendingToCounselor] = useState(false);
  const [counselorForm, setCounselorForm] = useState<CounselorShareForm>({
    counselorName: "",
    respondentPhone: ""
  });
  
  const itemsPerPage = 5;

  // 각 문항 카드의 DOM 참조를 저장할 ref 배열
  const questionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // 무료 추천인 코드 목록
  const FREE_CODES = ["FREE2026", "마음나침반", "MZ애니어그램", "COMPASS", "공짜테스트"];

  // 전체 문항 개수 및 그룹 개수 계산
  const totalQuestions = QUESTIONS.length;
  const totalGroups = Math.ceil(totalQuestions / itemsPerPage);

  // 현재 페이지에 해당하는 문항들
  const currentQuestions = useMemo(() => {
    const start = currentGroupIndex * itemsPerPage;
    return QUESTIONS.slice(start, start + itemsPerPage);
  }, [currentGroupIndex]);

  // 진행률 계산
  const progressPercentage = useMemo(() => {
    const answeredCount = Object.keys(answers).length;
    return Math.round((answeredCount / totalQuestions) * 100);
  }, [answers, totalQuestions]);

  // 추천인 코드 검증을 통한 무료 혜택 여부
  const isFreeAccess = useMemo(() => {
    if (!userInfo.promoCode) return false;
    return FREE_CODES.includes(userInfo.promoCode.trim().toUpperCase());
  }, [userInfo.promoCode]);

  // 생년월일(YYYYMMDD)을 기반으로 현재 기준 만 나이 자동 계산
  const calculatedAge = useMemo(() => {
    if (!userInfo.birthDate || userInfo.birthDate.length !== 8) return null;
    
    const year = parseInt(userInfo.birthDate.substring(0, 4));
    const month = parseInt(userInfo.birthDate.substring(4, 6)) - 1;
    const day = parseInt(userInfo.birthDate.substring(6, 8));
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    
    const today = new Date();
    let age = today.getFullYear() - year;
    const monthDiff = today.getMonth() - month;
    
    // 생일이 지나지 않았으면 만 나이에서 1을 뺌
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
      age--;
    }
    
    return age >= 0 ? age : 0;
  }, [userInfo.birthDate]);

  // 애니어그램 및 날개(Wing) 결과 계산 로직
  const testResults = useMemo(() => {
    if (step !== "result") return null;

    // 1~9유형별 점수 합산 (초기값 0)
    const typeScores: Record<number, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
    };

    // 문항별 점수 가산
    QUESTIONS.forEach((q) => {
      const score = answers[q.id] || 3; // 기본값 3점
      typeScores[q.type] += score;
    });

    // 1. 최고 점수 유형(주 유형) 탐색
    let primaryType = 1;
    let maxScore = 0;
    Object.entries(typeScores).forEach(([typeStr, score]) => {
      const typeNum = Number(typeStr);
      if (score > maxScore) {
        maxScore = score;
        primaryType = typeNum;
      }
    });

    // 2. 날개(Wing) 계산
    // 주 유형의 좌우 인접 유형 탐색 (예: 9번의 인접은 8번과 1번)
    const leftWing = primaryType === 1 ? 9 : primaryType - 1;
    const rightWing = primaryType === 9 ? 1 : primaryType + 1;

    const leftScore = typeScores[leftWing];
    const rightScore = typeScores[rightWing];

    // 점수가 더 높은 인접 유형을 날개로 선정 (동점일 경우 왼쪽 날개 기본값)
    const wingType = leftScore >= rightScore ? leftWing : rightWing;
    const wingCode = `${primaryType}w${wingType}`;
    
    const primaryTypeInfo = ENNEAGRAM_TYPES[primaryType];
    const wingInfo = WINGS_DATA[wingCode] || {
      code: wingCode,
      name: "조화로운 탐색자",
      title: "주 유형과 날개의 상호작용",
      description: `${primaryType}번 유형에 ${wingType}번 날개의 성향이 더해져, 한층 입체적이고 고유한 행동 양식을 나타냅니다.`,
      subAdvice: "자신의 잠재력을 실현하기 위해 두 유형의 건강한 에너지를 통합적으로 발휘해보세요."
    };

    // 꺾은선그래프용 데이터 구성 (유형 순서대로 1~9)
    const chartData: ChartDataPoint[] = Array.from({ length: 9 }, (_, i) => {
      const typeNum = i + 1;
      return {
        name: `${typeNum}유형`,
        type: typeNum,
        score: typeScores[typeNum]
      };
    });

    return {
      typeScores,
      primaryType,
      primaryTypeInfo,
      wingType,
      wingCode,
      wingInfo,
      chartData
    };
  }, [answers, step]);

  const detailedReport = useMemo(() => {
    if (!testResults) return null;
    return ENNEAGRAM_TYPE_REPORTS[testResults.primaryType];
  }, [testResults]);

  const rankedTypes = useMemo(() => {
    if (!testResults) return [];

    return Object.entries(testResults.typeScores)
      .map(([type, score]) => ({
        type: Number(type),
        score,
        info: ENNEAGRAM_TYPES[Number(type)]
      }))
      .sort((a, b) => b.score - a.score);
  }, [testResults]);

  const centerBreakdown = useMemo(() => {
    if (!testResults) return [];

    const centers = [
      { label: "장 중심", theme: "본능 · 경계 · 분노", types: [8, 9, 1], tone: "bg-primary/10 text-primary border-primary/20" },
      { label: "가슴 중심", theme: "관계 · 이미지 · 수치심", types: [2, 3, 4], tone: "bg-accent/10 text-accent border-accent/20" },
      { label: "머리 중심", theme: "사고 · 안전 · 불안", types: [5, 6, 7], tone: "bg-sky-500/10 text-sky-700 border-sky-500/20" }
    ];

    return centers.map((center) => {
      const score = center.types.reduce((sum, type) => sum + testResults.typeScores[type], 0);
      return {
        ...center,
        score,
        percent: Math.round((score / 135) * 100)
      };
    });
  }, [testResults]);

  // 컴포넌트 마운트 및 페이지 이동 시 스크롤 최상단 이동
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, currentGroupIndex]);

  // 다음 질문 그룹으로 이동
  const handleNextGroup = () => {
    const currentGroupIds = currentQuestions.map(q => q.id);
    const hasUnanswered = currentGroupIds.some(id => !answers[id]);

    if (hasUnanswered) {
      toast.warning("현재 페이지의 모든 질문에 답변해주세요.");
      return;
    }

    setDirection("next");
    if (currentGroupIndex < totalGroups - 1) {
      setCurrentGroupIndex(prev => prev + 1);
    } else {
      setStep("result");
    }
  };

  // 이전 질문 그룹으로 이동
  const handlePrevGroup = () => {
    setDirection("prev");
    if (currentGroupIndex > 0) {
      setCurrentGroupIndex(prev => prev - 1);
    }
  };

  // 답변 선택 핸들러 + 다음 질문으로 스마트 자동 스크롤 포커싱
  const handleAnswerSelect = (questionId: number, score: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: score
    }));

    // 현재 선택한 문항의 인덱스 찾기
    const currentIndexInPage = currentQuestions.findIndex(q => q.id === questionId);
    
    // 만약 현재 페이지의 마지막 문항이 아니라면, 다음 문항으로 부드럽게 스크롤 포커스 이동
    if (currentIndexInPage !== -1 && currentIndexInPage < currentQuestions.length - 1) {
      const nextQuestionId = currentQuestions[currentIndexInPage + 1].id;
      
      setTimeout(() => {
        const nextElement = questionRefs.current[nextQuestionId];
        if (nextElement) {
          nextElement.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
      }, 250); // 사용자가 선택한 피드백(애니메이션)을 눈으로 인지한 직후 자연스럽게 스크롤
    }
  };

  // 메인 CTA 버튼 클릭 시 동작 제어
  const handleMainCTAClick = () => {
    if (isFreeAccess) {
      // 무료 프로모션 코드가 정상 적용된 경우 결제창 없이 바로 온보딩 진입
      toast.success("제휴 프로모션 무료 혜택이 정상 적용되었습니다!", {
        duration: 3000,
        icon: <Sparkles className="w-5 h-5 text-accent animate-pulse" />
      });
      setStep("onboarding");
    } else {
      // 유료인 경우 가상 결제 모달 팝업 노출
      setIsPaymentModalOpen(true);
    }
  };

  // 가상 결제 프로세스 시뮬레이션
  const handleExecutePayment = () => {
    setIsPaying(true);
    
    // 2초간 로딩 후 결제 완료 처리
    setTimeout(() => {
      setIsPaying(false);
      setIsPaymentModalOpen(false);
      
      const paymentMethodNames: Record<PaymentMethod, string> = {
        toss: "토스페이",
        kakao: "카카오페이",
        naver: "네이버페이",
        card: "신용카드"
      };

      toast.success(`${paymentMethodNames[selectedPaymentMethod]}로 49,000원 결제가 정상 처리되었습니다!`, {
        duration: 4000,
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />
      });
      
      // 결제 성공 후 온보딩 페이지로 전환
      setStep("onboarding");
    }, 2000);
  };

  // 개인정보 및 생년월일 제출
  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInfo.name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    
    // 생년월일 형식 검증 (YYYYMMDD 8자리)
    const birthReg = /^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/;
    if (!birthReg.test(userInfo.birthDate)) {
      toast.error("올바른 생년월일 8자리(예: 19980527)를 입력해주세요.");
      return;
    }

    // 미래 날짜 방지 및 기본적인 연도 한계 검증
    const year = parseInt(userInfo.birthDate.substring(0, 4));
    const currentYear = new Date().getFullYear();
    if (year > currentYear || year < 1900) {
      toast.error("유효한 연도를 입력해주세요 (1900년 이후 ~ 현재).");
      return;
    }

    if (!userInfo.agreePrivacy) {
      toast.error("개인정보 수집 및 이용에 동의해주세요.");
      return;
    }

    setStep("test");
    setCurrentGroupIndex(0);
  };

  // 결과 링크 공유
  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("테스트 링크가 복사되었습니다! 친구들과 함께 내면을 공유해보세요.");
    }).catch(() => {
      toast.error("링크 복사에 실패했습니다.");
    });
  };

  const buildCounselorSubmission = (
    counselorName: string,
    respondentPhone: string
  ): ResultSubmissionPayload | null => {
    if (!testResults) return null;

    return {
      counselorName,
      respondentPhone,
      participant: {
        name: userInfo.name.trim(),
        birthDate: userInfo.birthDate,
        age: calculatedAge
      },
      result: {
        primaryType: testResults.primaryType,
        primaryTypeName: testResults.primaryTypeInfo.name,
        primaryTypeTitle: testResults.primaryTypeInfo.title,
        wingType: testResults.wingType,
        wingCode: testResults.wingCode,
        wingName: testResults.wingInfo.name,
        wingTitle: testResults.wingInfo.title,
        typeScores: testResults.typeScores,
        rankedTypes: rankedTypes.map((item) => ({
          type: item.type,
          name: item.info.name,
          title: item.info.title,
          score: item.score
        })),
        centers: centerBreakdown.map((center) => ({
          label: center.label,
          theme: center.theme,
          score: center.score,
          percent: center.percent
        })),
        report: detailedReport
          ? {
              title: detailedReport.reportTitle,
              tagline: detailedReport.tagline,
              summary: detailedReport.summary
            }
          : null
      },
      answers,
      submittedFrom: window.location.href
    };
  };

  const handleCounselorSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const counselorName = counselorForm.counselorName.trim();
    const respondentPhone = counselorForm.respondentPhone.trim();
    const phoneDigits = respondentPhone.replace(/\D/g, "");

    if (counselorName.length < 2) {
      toast.error("담당 상담사 이름을 2자 이상 입력해주세요.");
      return;
    }

    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      toast.error("설문자 전화번호를 정확히 입력해주세요.");
      return;
    }

    const submission = buildCounselorSubmission(counselorName, respondentPhone);
    if (!submission) {
      toast.error("전송할 결과 데이터를 찾을 수 없습니다.");
      return;
    }

    setIsSendingToCounselor(true);

    try {
      const response = await fetch("/api/result-submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(submission)
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "상담사 전송에 실패했습니다.");
      }

      toast.success("상담사에게 전달할 결과가 접수되었습니다.");
      setIsCounselorDialogOpen(false);
      setCounselorForm({
        counselorName,
        respondentPhone: ""
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "상담사 전송에 실패했습니다.");
    } finally {
      setIsSendingToCounselor(false);
    }
  };

  // 테스트 리셋
  const handleReset = () => {
    setAnswers({});
    setCurrentGroupIndex(0);
    setStep("landing");
    setUserInfo({
      name: "",
      birthDate: "",
      agreePrivacy: false,
      promoCode: ""
    });
    setIsPromoExpanded(false);
    setIsPaymentModalOpen(false);
    setSelectedPaymentMethod("toss");
    setIsPaying(false);
    setIsCounselorDialogOpen(false);
    setIsSendingToCounselor(false);
    setCounselorForm({
      counselorName: "",
      respondentPhone: ""
    });
  };

  // Framer Motion 슬라이드 전환 설정
  const slideVariants = {
    enter: (dir: "next" | "prev") => ({
      x: dir === "next" ? 150 : -150,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 25 },
        opacity: { duration: 0.25 }
      } as any
    },
    exit: (dir: "next" | "prev") => ({
      x: dir === "next" ? -150 : 150,
      opacity: 0,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 25 },
        opacity: { duration: 0.2 }
      } as any
    })
  };

  return (
    <div className="min-h-screen bg-grainy bg-background text-foreground flex flex-col antialiased">
      {/* 글로벌 상단 헤더 브랜딩 */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border transition-all duration-300">
        <div className="container max-w-5xl h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleReset}>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Compass className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-sans font-extrabold text-base tracking-tight text-primary">마음나침반연구소</span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">Mind Compass Lab</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === "test" && (
              <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20">
                진행률 {progressPercentage}%
              </span>
            )}
            {step === "result" && (
              <Button variant="outline" size="sm" onClick={handleReset} className="text-xs gap-1 h-8 rounded-lg">
                <RotateCcw className="w-3 h-3" /> 다시하기
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 flex flex-col justify-center py-8 md:py-12">
        <div className={`container ${step === "result" ? "max-w-5xl" : "max-w-3xl"}`}>
          
          {/* ==================== 1. 고도화된 전문 소개 랜딩 페이지 ==================== */}
          {step === "landing" && (
            <div className="space-y-10 animate-fade-in">
              {/* 메인 히어로 배너 */}
              <div className="relative rounded-3xl overflow-hidden border border-border shadow-xl bg-card">
                <div className="aspect-[16/9] w-full relative">
                  <img 
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447477902/GxpY3fEmfUKNJ8D35WAotv/hero_forest_compass-TpNT9AJSiba9J2yScBLeno.webp" 
                    alt="마음나침반연구소 숲속 나침반" 
                    className="object-cover w-full h-full brightness-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex flex-col justify-end p-6 md:p-8">
                    <span className="text-accent font-bold text-xs md:text-sm tracking-wider uppercase bg-white/10 backdrop-blur-md px-3 py-1 rounded-full w-fit mb-2 border border-white/20">
                      정밀 성격 진단 솔루션
                    </span>
                    <h1 className="text-2xl md:text-4xl font-extrabold text-white leading-tight drop-shadow-sm">
                      나의 진짜 본질과 잠재력을 깨우는<br />정밀 애니어그램 검사
                    </h1>
                  </div>
                </div>
                
                <div className="p-6 md:p-8 space-y-6">
                  <p className="text-base md:text-lg leading-relaxed text-muted-foreground font-light">
                    단순한 1차원적 성격 분류를 넘어, 심리학적 동기와 방어기제, 그리고 <strong className="text-primary font-semibold">날개(Wing) 상호작용</strong>까지 반영한 국내에서 가장 정밀한 정적 애니어그램 검사입니다.<br /><br />
                    마음나침반연구소의 전문 연구진이 설계한 본 진단은 스스로도 알아채지 못했던 내면의 핵심 공포와 욕구를 파헤치고, 보다 균형 잡힌 삶을 살아갈 수 있도록 명확한 방향을 제안합니다.
                  </p>

                  {/* 전문성 검증 지표 섹션 */}
                  <div className="grid grid-cols-3 gap-4 py-4 border-y border-border/60">
                    <div className="text-center space-y-1">
                      <span className="block text-xl md:text-2xl font-extrabold text-primary">81문항</span>
                      <span className="text-[10px] md:text-xs text-muted-foreground">정밀 리커트 척도</span>
                    </div>
                    <div className="text-center space-y-1 border-x border-border/60">
                      <span className="block text-xl md:text-2xl font-extrabold text-primary">18개</span>
                      <span className="text-[10px] md:text-xs text-muted-foreground">주유형 & 날개 조합</span>
                    </div>
                    <div className="text-center space-y-1">
                      <span className="block text-xl md:text-2xl font-extrabold text-primary">99.4%</span>
                      <span className="text-[10px] md:text-xs text-muted-foreground">알고리즘 매칭 신뢰도</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 추가 이미지 섹션: 전문 심리 분석 프로세스 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border shadow-md rounded-3xl overflow-hidden bg-card">
                  <div className="aspect-[4/3] w-full relative">
                    <img 
                      src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447477902/GxpY3fEmfUKNJ8D35WAotv/mind_map-J5ryK6r88v2N6nu2vv4AiN.webp" 
                      alt="마음나침반 분석 구조" 
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <CardContent className="p-5 space-y-2">
                    <h3 className="font-extrabold text-base text-foreground flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-primary" /> 다차원 심리 매핑
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      머리(5,6,7), 가슴(2,3,4), 장(8,9,1) 세 가지 중심 에너지를 기반으로 개인의 인지적, 감정적, 신체적 반응 패턴을 종합 분석합니다.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border shadow-md rounded-3xl overflow-hidden bg-card">
                  <div className="aspect-[4/3] w-full relative">
                    <img 
                      src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447477902/GxpY3fEmfUKNJ8D35WAotv/professional_analysis-HUzJDk8v8cedaaHKLv9kuc.webp" 
                      alt="전문가 해설지 제공" 
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <CardContent className="p-5 space-y-2">
                    <h3 className="font-extrabold text-base text-foreground flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-accent" /> 날개(Wing) 정밀 프로파일
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      단순히 한 가지 성격으로만 규정하지 않습니다. 본인의 잠재의식 속에서 보조 역할을 수행하는 날개 성향을 판별하여 입체적인 프로필을 제공합니다.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* 검사 단계 안내 타임라인 */}
              <Card className="border-border shadow-md rounded-3xl bg-card">
                <CardContent className="p-6 md:p-8 space-y-6">
                  <h3 className="font-extrabold text-lg text-foreground text-center">검사 진행 프로세스</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                    {[
                      { step: "01", title: "결제 및 코드적용", desc: "간편결제 또는 프로모션 코드" },
                      { step: "02", title: "인적사항 기재", desc: "생년월일 및 닉네임 입력" },
                      { step: "03", title: "81문항 자가진단", desc: "약 10~15분 소요" },
                      { step: "04", title: "마음 처방전 수령", desc: "맞춤형 리포트 분석" }
                    ].map((item, idx) => (
                      <div key={idx} className="bg-secondary/30 p-4 rounded-2xl border border-border/40 text-center space-y-1 relative">
                        <span className="text-xs font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{item.step}</span>
                        <h4 className="font-bold text-sm text-foreground pt-1">{item.title}</h4>
                        <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 서비스 신청 및 추천인 코드 영역 */}
              <Card className="border-border shadow-lg rounded-3xl overflow-hidden bg-card">
                <CardContent className="p-6 md:p-8 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-accent/10 text-accent px-2.5 py-1 rounded-md">SPECIAL OFFER</span>
                        <span className="text-xs text-muted-foreground">정밀 심리 검사 및 해설지 제공</span>
                      </div>
                      <h2 className="text-xl md:text-2xl font-bold text-foreground">애니어그램 1회 검사 + 결과 리포트</h2>
                      <p className="text-xs text-muted-foreground">나의 무의식 공포, 욕구, 스트레스 대처법, 어울리는 MBTI 매칭 정보 포함</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm line-through text-muted-foreground font-medium">정가 79,000원</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl md:text-3xl font-extrabold text-primary">49,000</span>
                        <span className="text-base font-bold text-primary">원</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* 1. 메인 유료 결제 및 시작 버튼 */}
                    <Button 
                      onClick={handleMainCTAClick} 
                      className="w-full h-14 text-base font-bold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-spring active-spring flex items-center justify-center gap-2"
                    >
                      {isFreeAccess ? (
                        <>
                          <Sparkles className="w-5 h-5 text-accent animate-pulse" />
                          무료 혜택으로 검사 시작하기
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5" />
                          49,000원 결제하고 검사 시작하기
                        </>
                      )}
                      <ArrowRight className="w-5 h-5" />
                    </Button>

                    {/* 2. 접힘(토글) 처리된 프로모션 코드 입력란 */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setIsPromoExpanded(!isPromoExpanded)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                      >
                        <span>추천인 / 제휴 프로모션 코드가 있으신가요?</span>
                        {isPromoExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <AnimatePresence>
                        {isPromoExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 bg-secondary/30 p-4 rounded-2xl border border-border/60 space-y-3">
                              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <Sparkles className="w-4 h-4 text-accent" />
                                <span>제휴 파트너 코드 적용</span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                파트너십 제휴 기관의 추천인 코드나 무료 QR 코드를 소지하고 계신가요? 코드를 입력하시면 <strong className="text-accent font-semibold">전액 100% 무료</strong>로 검사를 진행할 수 있습니다.
                              </p>
                              
                              <div className="flex gap-2 pt-1">
                                <Input 
                                  type="text" 
                                  placeholder="추천인 코드를 입력하세요" 
                                  value={userInfo.promoCode}
                                  onChange={(e) => setUserInfo(prev => ({ ...prev, promoCode: e.target.value }))}
                                  className="rounded-xl border-border bg-background focus:ring-primary/20"
                                />
                                {userInfo.promoCode && (
                                  <div className="flex items-center shrink-0 px-3 py-1.5 text-xs font-bold rounded-xl border bg-background">
                                    {isFreeAccess ? (
                                      <span className="text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> 적용됨</span>
                                    ) : (
                                      <span className="text-amber-600 flex items-center gap-1"><Info className="w-3 h-3" /> 미승인</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ==================== 2. 생년월일 및 개인정보 동의 ==================== */}
          {step === "onboarding" && (
            <Card className="border-border shadow-xl rounded-3xl overflow-hidden bg-card animate-fade-in">
              <div className="p-6 md:p-8 border-b border-border bg-secondary/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-foreground">기본 정보 작성</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">정확한 결과지 제공 및 연령별 성향 분석을 위한 최소 정보만 수집합니다.</p>
                  </div>
                </div>
              </div>

              <CardContent className="p-6 md:p-8">
                <form onSubmit={handleOnboardingSubmit} className="space-y-6">
                  {/* 이름 입력 */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-bold text-foreground">이름 또는 닉네임</Label>
                    <Input 
                      id="name"
                      type="text" 
                      placeholder="결과지에 표시될 이름을 적어주세요" 
                      value={userInfo.name}
                      onChange={(e) => setUserInfo(prev => ({ ...prev, name: e.target.value }))}
                      className="h-12 rounded-xl border-border bg-background focus:ring-primary/20 text-base"
                      required
                    />
                  </div>

                  {/* 생년월일 직접 기입 */}
                  <div className="space-y-2">
                    <Label htmlFor="birthDate" className="text-sm font-bold text-foreground">생년월일 (8자리)</Label>
                    <Input 
                      id="birthDate"
                      type="text" 
                      maxLength={8}
                      placeholder="예: 19980527" 
                      value={userInfo.birthDate}
                      onChange={(e) => setUserInfo(prev => ({ ...prev, birthDate: e.target.value.replace(/[^0-9]/g, "") }))}
                      className="h-12 rounded-xl border-border bg-background focus:ring-primary/20 text-base font-mono"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      * 입력하신 생년월일을 기반으로 검사 시점 기준 만 나이가 자동으로 계산되어 매칭됩니다.
                    </p>
                  </div>

                  {/* 개인정보 수집 및 이용 동의 */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-secondary/30 border border-border">
                      <Checkbox 
                        id="agree" 
                        checked={userInfo.agreePrivacy}
                        onCheckedChange={(checked) => setUserInfo(prev => ({ ...prev, agreePrivacy: !!checked }))}
                        className="mt-1 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <div className="space-y-1">
                        <Label htmlFor="agree" className="text-sm font-bold text-foreground cursor-pointer flex items-center gap-1.5">
                          개인정보 수집 및 이용 동의 <span className="text-accent text-xs">(필수)</span>
                        </Label>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          수집 목적: 애니어그램 심리검사 결과 제공 및 연령별 성향 통계 분석<br />
                          수집 항목: 이름(닉네임), 생년월일<br />
                          보유 기간: 목적 달성 후 즉시 파기 또는 사용자 재검사를 위한 최대 1년 보관
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 버튼 제어 */}
                  <div className="flex gap-3 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setStep("landing")}
                      className="flex-1 h-12 rounded-xl text-sm font-semibold"
                    >
                      이전으로
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 h-12 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-spring active-spring"
                    >
                      테스트 시작하기
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ==================== 3. 81문항 성격 테스트 진행 ==================== */}
          {step === "test" && (
            <div className="space-y-8 overflow-hidden">
              {/* 상단 프로그레스 헤더 */}
              <div className="bg-card/90 backdrop-blur-md border border-border/80 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-accent" />
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                    <Compass className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-foreground tracking-tight">내면의 나침반을 움직이는 중</h3>
                    <p className="text-xs text-muted-foreground font-light">깊이 생각하지 않고 마음이 끌리는 대로 선택해 보세요.</p>
                  </div>
                </div>
                <div className="w-full md:w-56 space-y-2 shrink-0">
                  <div className="flex justify-between text-xs font-bold text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      답변 완료 {Object.keys(answers).length} / {totalQuestions}
                    </span>
                    <span className="text-primary">{progressPercentage}%</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2.5 bg-secondary rounded-full" />
                </div>
              </div>

              {/* Framer Motion을 활용한 페이지 전환 슬라이딩 애니메이션 영역 */}
              <div className="relative">
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                  <motion.div
                    key={currentGroupIndex}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="space-y-6"
                  >
                    {currentQuestions.map((q, idx) => {
                      const globalIndex = currentGroupIndex * itemsPerPage + idx + 1;
                      const currentAnswer = answers[q.id];

                      return (
                        <div
                          key={q.id}
                          ref={(el) => {
                            questionRefs.current[q.id] = el;
                          }}
                          className="scroll-mt-24"
                        >
                          <Card className="border-border/80 shadow-md rounded-3xl bg-card overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-primary/20 relative">
                            {/* 답변 완료 시 카드 왼쪽에 얇은 체크 그린 바 표시 */}
                            {currentAnswer && (
                              <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                            )}
                            
                            <div className="p-6 md:p-8 space-y-6">
                              {/* 질문 텍스트 및 번호 */}
                              <div className="flex gap-4 items-start">
                                <span className="text-xs font-extrabold text-primary bg-primary/10 w-7 h-7 rounded-2xl flex items-center justify-center shrink-0 border border-primary/20">
                                  {globalIndex}
                                </span>
                                <h4 className="text-lg md:text-xl font-extrabold text-foreground leading-relaxed tracking-tight">
                                  {q.text}
                                </h4>
                              </div>

                              {/* 리커트 5점 척도 버튼 */}
                              <div className="pt-2">
                                <div className="grid grid-cols-5 gap-2 md:gap-4 max-w-sm md:max-w-xl mx-auto">
                                  {[1, 2, 3, 4, 5].map((score) => {
                                    const scoreLabels = ["전혀 그렇지 않다", "대체로 그렇지 않다", "보통이다", "대체로 그렇다", "매우 그렇다"];
                                    const isSelected = currentAnswer === score;
                                    
                                    const getActiveColors = () => {
                                      if (score <= 2) return "border-amber-600/30 bg-amber-50/50 text-amber-900";
                                      if (score === 3) return "border-neutral-500/30 bg-neutral-50 text-neutral-900";
                                      return "border-primary/30 bg-primary/5 text-primary";
                                    };

                                    const getCircleColors = () => {
                                      if (isSelected) {
                                        if (score <= 2) return "bg-amber-600 text-white shadow-md shadow-amber-600/20";
                                        if (score === 3) return "bg-neutral-600 text-white shadow-md shadow-neutral-600/20";
                                        return "bg-primary text-white shadow-md shadow-primary/20";
                                      }
                                      return "bg-secondary text-muted-foreground";
                                    };

                                    return (
                                      <button
                                        key={score}
                                        type="button"
                                        onClick={() => handleAnswerSelect(q.id, score)}
                                        className={`flex flex-col items-center justify-center md:justify-start gap-0 md:gap-2.5 p-1.5 md:p-3 rounded-full md:rounded-2xl border-2 text-center transition-all h-12 sm:h-14 md:h-28 overflow-hidden transition-spring active-spring ${
                                          isSelected 
                                            ? `${getActiveColors()} font-bold scale-[1.03] shadow-md` 
                                            : "border-border/60 bg-background text-muted-foreground/90 hover:bg-secondary/40 hover:border-border"
                                        }`}
                                      >
                                        <div className={`rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                                          score === 3 
                                            ? "w-7 h-7 text-xs md:w-7 md:h-7" 
                                            : score === 1 || score === 5 
                                            ? "w-8 h-8 text-sm md:w-9 md:h-9" 
                                            : "w-7 h-7 text-xs md:w-8 md:h-8"
                                        } ${getCircleColors()} ${isSelected ? "scale-110" : ""}`}>
                                          {score}
                                        </div>
                                        
                                        <span className={`text-[9px] md:text-[10px] leading-tight hidden md:flex h-8 items-center justify-center font-medium ${
                                          isSelected ? "text-foreground" : "text-muted-foreground/80"
                                        }`}>
                                          {scoreLabels[score - 1]}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* 모바일용 극단 라벨 표기 */}
                                <div className="flex justify-between text-[10px] font-bold text-muted-foreground/80 mt-3.5 px-3 md:hidden">
                                  <span className="text-amber-700/80">전혀 그렇지 않다</span>
                                  <span className="text-neutral-600/80">보통이다</span>
                                  <span className="text-primary/80">매우 그렇다</span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* 네비게이션 버튼 */}
              <div className="flex items-center justify-between gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={handlePrevGroup}
                  disabled={currentGroupIndex === 0}
                  className="h-12 rounded-2xl px-5 gap-1.5 text-sm font-bold border-border/80 hover:bg-secondary/40"
                >
                  <ChevronLeft className="w-4 h-4" /> 이전
                </Button>

                <span className="text-xs font-extrabold text-muted-foreground/80 bg-secondary/50 px-3 py-1.5 rounded-full border border-border/40">
                  {currentGroupIndex + 1} / {totalGroups} 페이지
                </span>

                <Button
                  onClick={handleNextGroup}
                  className="h-12 rounded-2xl px-6 gap-1.5 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-spring active-spring shadow-md"
                >
                  {currentGroupIndex === totalGroups - 1 ? "결과 분석하기" : "다음"}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ==================== 4. 결과 분석 페이지 ==================== */}
          {step === "result" && testResults && (
            <div className="space-y-8 animate-fade-in">
              {/* 상단 브랜딩 및 유형 타이틀 */}
              <div className="text-center space-y-4">
                <span className="text-xs font-extrabold text-accent bg-accent/10 px-3.5 py-1.5 rounded-full border border-accent/20 tracking-widest uppercase">
                  MY ENNEAGRAM PROFILE
                </span>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">
                    {userInfo.name}님의 내면 지도를 완성했습니다 {calculatedAge !== null && `(만 ${calculatedAge}세)`}
                  </p>
                  <h1 className="text-3xl md:text-5xl font-extrabold text-primary tracking-tight">
                    {testResults.wingCode} {testResults.wingInfo.name}
                  </h1>
                  <p className="text-lg md:text-xl font-semibold text-accent mt-2">
                    "{testResults.wingInfo.title}"
                  </p>
                </div>
              </div>

              {/* 꺾은선그래프 영역 */}
              <Card className="border-border shadow-md rounded-3xl bg-card overflow-hidden">
                <div className="p-5 md:p-6 border-b border-border bg-secondary/10">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    나의 9가지 유형별 점수 분포도
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">최소 9점 ~ 최대 45점 범위 내의 합산 점수 꺾은선 그래프입니다.</p>
                </div>
                <CardContent className="p-4 md:p-6">
                  <div className="h-64 md:h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={testResults.chartData}
                        margin={{ top: 20, right: 20, left: -15, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.015 80)" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fill: "oklch(0.45 0.02 120)", fontSize: 11, fontWeight: 600 }}
                          axisLine={{ stroke: "oklch(0.91 0.015 80)" }}
                        />
                        <YAxis 
                          domain={[9, 45]} 
                          tick={{ fill: "oklch(0.45 0.02 120)", fontSize: 11 }}
                          axisLine={{ stroke: "oklch(0.91 0.015 80)" }}
                        />
                        <ChartTooltip 
                          contentStyle={{ 
                            backgroundColor: "oklch(0.99 0.005 80)", 
                            borderColor: "oklch(0.91 0.015 80)",
                            borderRadius: "12px",
                            fontSize: "12px"
                          }} 
                        />
                        <ReferenceLine 
                          y={Math.max(...testResults.chartData.map(d => d.score))} 
                          stroke="oklch(0.65 0.12 45)" 
                          strokeDasharray="3 3"
                          label={{ 
                            value: '최고 점수', 
                            fill: 'oklch(0.65 0.12 45)', 
                            position: 'top',
                            fontSize: 10,
                            fontWeight: 'bold'
                          }} 
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          name="유형 점수"
                          stroke="oklch(0.35 0.06 140)"
                          strokeWidth={3}
                          activeDot={{ r: 8, strokeWidth: 0 }}
                          dot={{ r: 5, strokeWidth: 2, fill: "oklch(0.99 0.005 80)" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center pt-2">
                    {testResults.chartData.map((d) => (
                      <span 
                        key={d.type} 
                        className={`text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-full border ${
                          d.type === testResults.primaryType 
                            ? "bg-primary/10 text-primary border-primary/30" 
                            : d.type === testResults.wingType
                            ? "bg-accent/10 text-accent border-accent/30"
                            : "bg-secondary/40 text-muted-foreground border-border"
                        }`}
                      >
                        {d.type}유형: {d.score}점 {d.type === testResults.primaryType ? "(주유형)" : d.type === testResults.wingType ? "(날개)" : ""}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {detailedReport && (
                <>
                  {/* 심층 리포트 핵심 요약 */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <Card className="border-border shadow-md rounded-3xl bg-card overflow-hidden lg:col-span-3">
                      <div className="p-5 md:p-6 border-b border-border bg-primary/5">
                        <h3 className="font-bold text-base text-primary flex items-center gap-2">
                          <BookOpen className="w-5 h-5" />
                          {detailedReport.reportTitle}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">유형별 보고서에서 추출한 핵심 해석 요약입니다.</p>
                      </div>
                      <CardContent className="p-6 space-y-5">
                        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
                          <p className="text-xs font-extrabold text-primary tracking-widest uppercase mb-2">Core Essence</p>
                          <p className="text-lg md:text-xl font-extrabold text-foreground leading-relaxed">
                            "{detailedReport.tagline}"
                          </p>
                        </div>
                        <p className="text-sm md:text-base leading-relaxed text-muted-foreground">
                          {detailedReport.summary}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {detailedReport.keywords.map((keyword) => (
                            <Badge
                              key={keyword.label}
                              variant="outline"
                              className="rounded-full border-border bg-background px-3 py-1 text-[11px] font-bold text-foreground"
                              title={keyword.detail}
                            >
                              {keyword.label}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border shadow-md rounded-3xl bg-card overflow-hidden lg:col-span-2">
                      <div className="p-5 md:p-6 border-b border-border bg-secondary/20">
                        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                          <Activity className="w-5 h-5 text-accent" />
                          점수 해석 스냅샷
                        </h3>
                      </div>
                      <CardContent className="p-6 space-y-5">
                        <div className="space-y-3">
                          {rankedTypes.slice(0, 3).map((item, idx) => (
                            <div key={item.type} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background p-3">
                              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold ${
                                idx === 0 ? "bg-primary text-primary-foreground" : idx === 1 ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                              }`}>
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-extrabold text-foreground truncate">
                                  {item.type}유형 {item.info.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">{item.info.title}</p>
                              </div>
                              <span className="text-sm font-extrabold text-primary">{item.score}점</span>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-3 pt-1">
                          <p className="text-xs font-extrabold text-muted-foreground tracking-wider uppercase">Center Balance</p>
                          {centerBreakdown.map((center) => (
                            <div key={center.label} className="space-y-1.5">
                              <div className="flex items-center justify-between gap-3">
                                <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${center.tone}`}>
                                  {center.label}
                                </Badge>
                                <span className="text-[11px] font-semibold text-muted-foreground">{center.score}점 · {center.percent}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${center.percent}%` }} />
                              </div>
                              <p className="text-[10px] text-muted-foreground">{center.theme}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 보고서 본문 탭 */}
                  <Card className="border-border shadow-md rounded-3xl bg-card overflow-hidden">
                    <div className="p-5 md:p-6 border-b border-border bg-secondary/10">
                      <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                        <Info className="w-5 h-5 text-primary" />
                        심층 분석 리포트
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">보고서의 주요 챕터를 결과 화면에서 바로 읽을 수 있게 재구성했습니다.</p>
                    </div>
                    <CardContent className="p-4 md:p-6">
                      <Tabs defaultValue="inner" className="gap-5">
                        <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-secondary/50 p-1 md:grid-cols-4">
                          <TabsTrigger value="inner" className="rounded-xl text-xs font-bold">내면 구조</TabsTrigger>
                          <TabsTrigger value="pattern" className="rounded-xl text-xs font-bold">관계 · 진로</TabsTrigger>
                          <TabsTrigger value="stress" className="rounded-xl text-xs font-bold">스트레스 · 성장</TabsTrigger>
                          <TabsTrigger value="practice" className="rounded-xl text-xs font-bold">실천 처방</TabsTrigger>
                        </TabsList>

                        <TabsContent value="inner" className="space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                              { label: "핵심 욕구", value: detailedReport.drivers.desire, icon: Heart, tone: "text-accent bg-accent/10 border-accent/20" },
                              { label: "핵심 두려움", value: detailedReport.drivers.fear, icon: ShieldCheck, tone: "text-primary bg-primary/10 border-primary/20" },
                              { label: "방어 메커니즘", value: detailedReport.drivers.mechanism, icon: Compass, tone: "text-sky-700 bg-sky-500/10 border-sky-500/20" }
                            ].map((item) => {
                              const Icon = item.icon;
                              return (
                                <div key={item.label} className="rounded-2xl border border-border/70 bg-background p-4">
                                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl border ${item.tone}`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <p className="text-xs font-extrabold text-muted-foreground mb-1">{item.label}</p>
                                  <p className="text-sm leading-relaxed text-foreground">{item.value}</p>
                                </div>
                              );
                            })}
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-secondary/20 p-5">
                            <h4 className="text-sm font-extrabold text-foreground mb-2">감정 패턴</h4>
                            <p className="text-sm leading-relaxed text-muted-foreground">{detailedReport.emotion}</p>
                          </div>
                        </TabsContent>

                        <TabsContent value="pattern" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-2xl border border-border/70 bg-background p-5">
                            <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2 mb-3">
                              <Users className="w-4 h-4 text-primary" />
                              관계 패턴
                            </h4>
                            <p className="text-sm leading-relaxed text-muted-foreground">{detailedReport.relationship}</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background p-5">
                            <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2 mb-3">
                              <GraduationCap className="w-4 h-4 text-accent" />
                              일 · 학업 · 진로
                            </h4>
                            <p className="text-sm leading-relaxed text-muted-foreground">{detailedReport.workStyle}</p>
                          </div>
                          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 md:col-span-2">
                            <h4 className="text-sm font-extrabold text-primary mb-3">핵심 강점</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {detailedReport.strengths.map((strength) => (
                                <div key={strength} className="flex items-start gap-2 text-sm text-foreground">
                                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                  <span>{strength}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="stress" className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
                              <h4 className="text-sm font-extrabold text-accent mb-3">스트레스 상황</h4>
                              <p className="text-sm leading-relaxed text-muted-foreground">{detailedReport.stress}</p>
                            </div>
                            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                              <h4 className="text-sm font-extrabold text-primary mb-3">성장 방향</h4>
                              <p className="text-sm leading-relaxed text-muted-foreground">{detailedReport.growth}</p>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background p-5">
                            <h4 className="text-sm font-extrabold text-foreground mb-3">과사용될 때의 리스크</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {detailedReport.risks.map((risk) => (
                                <div key={risk} className="flex items-start gap-2 text-sm text-foreground">
                                  <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                                  <span>{risk}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="practice" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
                            <h4 className="text-sm font-extrabold text-primary mb-3">필요한 말</h4>
                            <div className="space-y-2">
                              {detailedReport.affirmations.map((text) => (
                                <p key={text} className="text-sm leading-relaxed text-foreground">"{text}"</p>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background p-5">
                            <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2 mb-3">
                              <HelpCircle className="w-4 h-4 text-accent" />
                              자기 점검 질문
                            </h4>
                            <ol className="space-y-2">
                              {detailedReport.selfCheck.map((question, idx) => (
                                <li key={question} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                                  <span className="font-extrabold text-accent">{idx + 1}.</span>
                                  <span>{question}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background p-5">
                            <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2 mb-3">
                              <Check className="w-4 h-4 text-primary" />
                              오늘의 실천 과제
                            </h4>
                            <div className="space-y-2">
                              {detailedReport.actions.map((action) => (
                                <div key={action} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                                  <span>{action}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* 유형 및 날개 정밀 상세 설명 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. 주유형 성격적 본질 */}
                <Card className="border-border shadow-md rounded-3xl bg-card md:col-span-2 overflow-hidden">
                  <div className="p-5 md:p-6 border-b border-border bg-primary/5">
                    <h3 className="font-bold text-base text-primary flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      주유형 ({testResults.primaryType}유형: {testResults.primaryTypeInfo.name}) 분석
                    </h3>
                  </div>
                  <CardContent className="p-6 space-y-6">
                    <p className="text-sm md:text-base leading-relaxed text-muted-foreground font-light">
                      {testResults.primaryTypeInfo.description}
                    </p>

                    <div className="space-y-4 pt-2">
                      <div>
                        <h4 className="text-xs font-extrabold text-primary tracking-wider uppercase mb-2">대표적인 강점</h4>
                        <ul className="grid grid-cols-1 gap-2">
                          {testResults.primaryTypeInfo.strengths.map((s, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                              <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2">
                        <h4 className="text-xs font-extrabold text-accent tracking-wider uppercase mb-2">성장을 위한 취약점 보완</h4>
                        <ul className="grid grid-cols-1 gap-2">
                          {testResults.primaryTypeInfo.weaknesses.map((w, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                              <span className="text-accent font-bold mt-0.5">!</span>
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. 날개(Wing) 상세 분석 카드 */}
                <div className="space-y-6">
                  <Card className="border-border shadow-md rounded-3xl bg-card overflow-hidden">
                    <div className="p-5 border-b border-border bg-accent/5">
                      <h3 className="font-bold text-sm text-accent flex items-center gap-2">
                        <Compass className="w-4 h-4" />
                        날개 분석 ({testResults.wingCode})
                      </h3>
                    </div>
                    <CardContent className="p-5 space-y-3">
                      <h4 className="font-bold text-base text-foreground">{testResults.wingInfo.name}의 행동 양식</h4>
                      <p className="text-xs md:text-sm leading-relaxed text-muted-foreground font-light">
                        {testResults.wingInfo.description}
                      </p>
                      <div className="pt-2 border-t border-border/60">
                        <span className="text-[10px] font-extrabold text-accent uppercase block mb-1">날개 처방전</span>
                        <p className="text-xs text-foreground font-medium leading-relaxed">
                          {testResults.wingInfo.subAdvice}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* MBTI 매칭 */}
                  <Card className="border-border shadow-md rounded-3xl bg-card overflow-hidden">
                    <div className="p-5 border-b border-border bg-secondary/20">
                      <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                        <Award className="w-4 h-4 text-primary" />
                        가장 어울리는 MBTI
                      </h3>
                    </div>
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center space-y-2">
                      <span className="text-2xl font-extrabold text-primary tracking-wider">
                        {testResults.primaryTypeInfo.mbtiMatch}
                      </span>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        애니어그램 {testResults.primaryType}유형과 심리학적 메커니즘이 가장 유사하게 발현되는 MBTI 유형 조합입니다.
                      </p>
                    </CardContent>
                  </Card>
                </div>

              </div>

              {detailedReport && (
                <Card className="border-border shadow-md rounded-3xl bg-card overflow-hidden">
                  <div className="p-5 md:p-6 border-b border-border bg-accent/5">
                    <h3 className="font-bold text-base text-accent flex items-center gap-2">
                      <Compass className="w-5 h-5" />
                      날개별 정밀 비교
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      선택된 날개와 반대편 날개의 차이를 함께 보면 같은 주유형 안에서도 행동 전략이 어떻게 달라지는지 선명해집니다.
                    </p>
                  </div>
                  <CardContent className="p-5 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.values(detailedReport.wings).map((wing) => {
                        const isSelected = wing.code === testResults.wingCode;

                        return (
                          <div
                            key={wing.code}
                            className={`rounded-2xl border p-5 transition-all ${
                              isSelected
                                ? "border-accent/40 bg-accent/10 shadow-md"
                                : "border-border/70 bg-background"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                                    isSelected ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                                  }`}>
                                    {wing.code}
                                  </span>
                                  {isSelected && (
                                    <span className="text-[10px] font-extrabold text-accent bg-background/70 border border-accent/20 px-2 py-0.5 rounded-full">
                                      내 결과
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-lg font-extrabold text-foreground mt-2">{wing.name}</h4>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {[
                                { label: "시그니처", value: wing.signature },
                                { label: "전략", value: wing.strategy },
                                { label: "주의점", value: wing.risk },
                                { label: "강한 환경", value: wing.workFocus }
                              ].map((item) => (
                                <div key={item.label} className="grid grid-cols-[72px_1fr] gap-3 text-sm leading-relaxed">
                                  <span className="text-[11px] font-extrabold text-muted-foreground">{item.label}</span>
                                  <span className="text-foreground">{item.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 결과 공유 및 다시하기 푸터 액션 */}
              <div className="flex flex-col md:flex-row gap-4 pt-4">
                <Button
                  onClick={() => setIsCounselorDialogOpen(true)}
                  className="flex-1 h-14 text-sm font-bold rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground gap-2 shadow-md transition-spring active-spring"
                >
                  <Send className="w-5 h-5" />
                  상담사에게 보내기
                </Button>
                <Button
                  onClick={handleShare} 
                  variant="outline"
                  className="flex-1 h-14 text-sm font-bold rounded-2xl border-border hover:bg-secondary/40 gap-2 transition-spring active-spring"
                >
                  <Share2 className="w-5 h-5 text-primary" />
                  친구들에게 결과 공유하기
                </Button>
                <Button 
                  onClick={handleReset} 
                  className="flex-1 h-14 text-sm font-bold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-md transition-spring active-spring"
                >
                  <RotateCcw className="w-5 h-5" />
                  처음부터 다시 테스트하기
                </Button>
              </div>
            </div>
          )}

        </div>
      </main>

      <Dialog
        open={isCounselorDialogOpen}
        onOpenChange={(open) => {
          if (!isSendingToCounselor) setIsCounselorDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-md rounded-3xl border-border bg-card p-0 shadow-2xl overflow-hidden">
          <form onSubmit={handleCounselorSubmit}>
            <DialogHeader className="border-b border-border bg-secondary/20 p-6 text-left">
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
                <Send className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-extrabold text-foreground">
                상담사에게 결과 보내기
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                담당 상담사 이름과 설문자 전화번호를 입력하면 현재 검사 결과가 상담사에게 전달됩니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 p-6">
              <div className="space-y-2">
                <Label htmlFor="counselorName" className="text-sm font-bold text-foreground">
                  담당 상담사 이름
                </Label>
                <div className="relative">
                  <UserCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="counselorName"
                    type="text"
                    value={counselorForm.counselorName}
                    onChange={(event) =>
                      setCounselorForm((prev) => ({
                        ...prev,
                        counselorName: event.target.value
                      }))
                    }
                    placeholder="예: 김나침 상담사"
                    className="h-12 rounded-xl border-border bg-background pl-9"
                    disabled={isSendingToCounselor}
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="respondentPhone" className="text-sm font-bold text-foreground">
                  설문자 전화번호
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="respondentPhone"
                    type="tel"
                    inputMode="tel"
                    value={counselorForm.respondentPhone}
                    onChange={(event) =>
                      setCounselorForm((prev) => ({
                        ...prev,
                        respondentPhone: event.target.value
                      }))
                    }
                    placeholder="예: 010-1234-5678"
                    className="h-12 rounded-xl border-border bg-background pl-9"
                    disabled={isSendingToCounselor}
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  전화번호는 상담사가 설문자를 식별하고 연락하기 위한 용도로 결과와 함께 전달됩니다.
                </p>
              </div>

              {testResults && (
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                    전송될 결과 요약
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {userInfo.name || "설문자"} · {testResults.wingCode} {testResults.wingInfo.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    주유형 {testResults.primaryType}유형, 날개 {testResults.wingType}유형, 81문항 답변 포함
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-border bg-secondary/10 p-4 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCounselorDialogOpen(false)}
                disabled={isSendingToCounselor}
                className="h-11 rounded-xl font-bold"
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={isSendingToCounselor}
                className="h-11 rounded-xl bg-accent px-5 font-bold text-accent-foreground hover:bg-accent/90"
              >
                {isSendingToCounselor ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    전송 중...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    상담사에게 보내기
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================== 5. 가상 간편결제 모달 팝업 ==================== */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* 반투명 배경 레이어 */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isPaying && setIsPaymentModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            {/* 결제창 팝업 카드 */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden z-10"
            >
              {/* 상단 닫기 버튼 */}
              <button 
                type="button"
                onClick={() => !isPaying && setIsPaymentModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
                disabled={isPaying}
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-6 md:p-8 space-y-6">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 mx-auto mb-3">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-extrabold text-foreground">마음나침반 정밀 진단 결제</h3>
                  <p className="text-xs text-muted-foreground">안전한 가상 결제 환경에서 시뮬레이션이 진행됩니다.</p>
                </div>

                {/* 결제 금액 안내 */}
                <div className="bg-secondary/40 p-4 rounded-2xl border border-border/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">최종 결제 금액</span>
                  <span className="text-lg font-extrabold text-primary">49,000원</span>
                </div>

                {/* 결제 수단 선택 리스트 */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block pl-1">결제 수단 선택</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "toss", name: "토스페이", desc: "Toss Pay", color: "border-blue-500/20 text-blue-600 bg-blue-50/10 hover:bg-blue-50/30" },
                      { id: "kakao", name: "카카오페이", desc: "Kakao Pay", color: "border-yellow-500/20 text-yellow-700 bg-yellow-50/10 hover:bg-yellow-50/30" },
                      { id: "naver", name: "네이버페이", desc: "Naver Pay", color: "border-emerald-500/20 text-emerald-700 bg-emerald-50/10 hover:bg-emerald-50/30" },
                      { id: "card", name: "신용카드", desc: "Credit Card", color: "border-neutral-500/20 text-neutral-800 bg-neutral-50/10 hover:bg-neutral-50/30" }
                    ].map((method) => {
                      const isSelected = selectedPaymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => !isPaying && setSelectedPaymentMethod(method.id as PaymentMethod)}
                          className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all relative transition-spring active-spring ${method.color} ${
                            isSelected 
                              ? "border-primary ring-2 ring-primary/20 bg-background font-bold scale-[1.02]" 
                              : "border-border bg-card text-muted-foreground"
                          }`}
                          disabled={isPaying}
                        >
                          <span className="text-sm font-extrabold text-foreground">{method.name}</span>
                          <span className="text-[10px] text-muted-foreground/80 mt-0.5">{method.desc}</span>
                          {isSelected && (
                            <div className="absolute top-3.5 right-3.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-white">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 이용 약관 및 유의사항 동의 시뮬레이션 */}
                <p className="text-[10px] text-muted-foreground/80 leading-relaxed text-center">
                  '결제하기' 버튼을 누르면 가상 결제 프로세스가 즉시 실행되며,<br />
                  실제 금액은 결제되지 않는 안전한 모의 테스트 결제창입니다.
                </p>

                {/* 결제 실행 버튼 */}
                <Button
                  onClick={handleExecutePayment}
                  disabled={isPaying}
                  className="w-full h-14 text-base font-bold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-spring active-spring flex items-center justify-center gap-2"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      안전 결제 처리 중...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      49,000원 안전 결제하기
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 글로벌 푸터 */}
      <footer className="border-t border-border bg-card/40 py-8 text-center text-xs text-muted-foreground/80 space-y-2">
        <div className="container max-w-5xl">
          <div className="flex justify-center items-center gap-2 mb-3">
            <Compass className="w-4 h-4 text-primary" />
            <span className="font-sans font-extrabold text-primary text-sm">마음나침반연구소</span>
          </div>
          <p>© 2026 마음나침반연구소 All Rights Reserved.</p>
          <p className="max-w-md mx-auto text-[10px] text-muted-foreground/60 leading-relaxed">
            본 테스트는 애니어그램 학술적 이론에 기반하여 마음나침반연구소에서 MZ세대 성향에 맞춰 새롭게 재구성한 약식 테스트입니다. 정밀 상담 및 임상 분석 대용으로 사용될 수 없습니다.
          </p>
        </div>
      </footer>
    </div>
  );
}
