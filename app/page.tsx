'use client'; // 이 파일은 브라우저 화면을 그리고 사용자와 상호작용하는 프론트엔드(클라이언트) 코드임을 Next.js에게 알립니다.

// 화면의 상태 변화(업로드된 파일, 생성된 문제 등)를 기억하고 제어하기 위해 리액트 기본 도구인 useState를 불러옵니다.
import { useState } from 'react';
// AI가 보낸 텍스트 기호($...$)를 파싱하여 화면에 깔끔하게 보여주는 마크다운 렌더링 도구를 불러옵니다.
import ReactMarkdown from 'react-markdown';
// 수학적 기호와 문법 규칙을 해석해 주는 플러그인을 불러옵니다.
import remarkMath from 'remark-math';
// 해석된 수학 수식을 그래픽 디자인으로 예쁘게 그려주는 플러그인을 불러옵니다.
import rehypeKatex from 'rehype-katex';
// 위아래 분수나 루트 기호가 교과서처럼 올바른 모양과 크기로 그려지도록 KaTeX 전용 핵심 스타일(CSS)을 불러옵니다.
import 'katex/dist/katex.min.css';

export default function Home() {
  // 사용자가 선택한 실제 파일 객체(PDF, HWP)를 임시로 저장해 두는 상자입니다.
  const [file, setFile] = useState<File | null>(null);
  // 백엔드 서버에서 완성되어 넘어온 '쌍둥이 문제지' 텍스트를 저장하는 상자입니다.
  const [examResult, setExamResult] = useState('');
  // 백엔드 서버에서 완성되어 넘어온 '정답 및 해설지' 텍스트를 저장하는 상자입니다.
  const [answerResult, setAnswerResult] = useState('');
  // AI가 현재 열심히 문항을 출제하고 있는 중인지(로딩 상태) 기억하는 상자입니다. (true/false)
  const [loading, setLoading] = useState(false);

  // 🔢 사용자가 직접 키보드로 입력한 '출제 문항 수'를 저장하는 상자입니다. (기본값은 5개로 세팅)
  const [count, setCount] = useState('5');
  // 사용자가 특정 단원이나 파트를 지정해 입력한 글자를 저장하는 상자입니다.
  const [part, setPart] = useState('');

  // 사용자가 파일 선택창을 열거나 드래그앤드롭으로 파일을 올렸을 때 작동하는 검사 함수입니다.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 만약 사용자가 파일을 정상적으로 선택했고, 그 파일이 존재한다면 실행합니다.
    if (e.target.files && e.target.files[0]) {
      // 꺼내온 파일 정보를 임시 변수에 담습니다.
      const selectedFile = e.target.files[0];
      // 파일 이름(예: math.pdf)을 점('.') 기준으로 쪼갠 뒤 맨 마지막 확장자 글자만 추출하여 소문자로 통일합니다.
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      
      // 추출한 확장자가 pdf도 아니고 hwp도 아니라면 경고창을 띄우고 작업을 중단합니다.
      if (ext !== 'pdf' && ext !== 'hwp') {
        alert('PDF 또는 HWP 파일만 업로드할 수 있습니다!');
        return;
      }
      // 검사를 완벽히 통과한 건강한 파일 객체만 파일 보관 상자에 안전하게 저장합니다.
      setFile(selectedFile);
    }
  };

  // 사용자가 '쌍둥이 문제 & 해설지 생성 ✨' 이라는 메인 버튼을 클릭했을 때 가동되는 비동기 핵심 함수입니다.
  const handleGenerate = async () => {
    // 만약 파일 상자가 비어있다면 경고창을 띄우고 더 이상 코드를 실행하지 않고 멈춥니다.
    if (!file) return alert('파일을 먼저 업로드해 주세요!');
    
    // 글자 입력창에 적힌 문항 수 데이터를 컴퓨터가 계산할 수 있게 정수(숫자)로 바꿉니다.
    const parsedCount = parseInt(count);
    // 만약 숫자가 아니거나(글자를 적었거나), 0 이하의 엉뚱한 숫자를 적었다면 경고를 뿜고 멈춥니다.
    if (isNaN(parsedCount) || parsedCount <= 0) {
      return alert('올바른 문항 수를 입력해 주세요! (1 이상의 숫자)');
    }

    // AI 작동이 시작되었으므로 로딩 상자를 '참(true)'으로 바꾸어 화면에 로딩 애니메이션 등이 뜨게 만듭니다.
    setLoading(true);
    // 새로운 출제를 시작하기 전에 이전에 화면에 남아있던 오래된 문제지 결과를 깨끗하게 비웁니다.
    setExamResult('');
    // 이전에 화면에 남아있던 오래된 해설지 결과도 깨끗하게 비웁니다.
    setAnswerResult('');

    // 네트워크 통신 중 에러가 나더라도 프로그램이 튕기지 않고 안전하게 수습하도록 try-catch 문을 엽니다.
    try {
      // 대용량 파일과 사용자가 세팅한 조건 정보들을 한 보따리로 묶어줄 대형 폼 데이터 객체를 생성합니다.
      const formData = new FormData();
      // 보따리 안에 'file'이라는 이름표를 붙여서 진짜 파일 원본 데이터를 집어넣습니다.
      formData.append('file', file);
      // 보따리 안에 'count'라는 이름표를 붙여서 사용자가 직접 입력한 커스텀 문항 수를 집어넣습니다.
      formData.append('count', count);
      // 보따리 안에 'part'라는 이름표를 붙여서 특정 단원명을 집어넣습니다. (비어있으면 전체 범위라고 적어 보냅니다.)
      formData.append('part', part || '제공된 기출문제 전체 범위');

      // 우리가 미리 구축해 둔 백엔드 API 통로('/api/generate')로 폼 데이터 보따리를 전송(fetch)합니다.
      const res = await fetch('/api/generate', {
        method: 'POST', // 데이터 전송 표준 방식인 POST로 설정합니다.
        body: formData, // 우리가 묶어둔 폼 데이터 보따리를 통째로 몸체에 실어 보냅니다.
      });
      
      // 백엔드 서버가 구글 AI와 소통을 끝내고 돌려준 JSON 정답 보따리를 자바스크립트 객체로 파싱합니다.
      const data = await res.json();
      
      // 만약 정답 보따리 안에 문제지(exam)와 해설지(answer)가 정상적으로 둘 다 들어있다면 실행합니다.
      if (data.exam && data.answer) {
        // AI가 작성해 준 완벽한 포맷의 문제지 텍스트를 문제지 보관 상자에 저장합니다.
        setExamResult(data.exam);
        // AI가 작성해 준 완벽한 포맷의 해설지 텍스트를 해설지 보관 상자에 저장합니다.
        setAnswerResult(data.answer);
      } else {
        // 만약 서버에서 에러 메시지를 보냈다면 그 메시지를 보여주고, 없다면 기본 실패 안내를 띄웁니다.
        alert(data.error || '문제 생성에 실패했습니다.');
      }
    } catch (err) {
      // 통신 에러가 발생하면 개발자 브라우저 콘솔창에 빨간 글씨로 상세 원인을 기록합니다.
      console.error(err);
      // 사용자에게는 친절하게 오류가 났음을 안내합니다.
      alert('오류가 발생했습니다.');
    } finally {
      // 정상적으로 끝나든, 에러가 나서 튕겼든 상관없이 출제 작업이 끝났으므로 로딩 상태를 '거짓(false)'으로 끕니다.
      setLoading(false);
    }
  };

  // 💾 [핵심 변환기] 생성된 수식 텍스트를 한글 문서(HWP)가 좋아하는 형태로 가공하여 다운로드하는 함수입니다.
  const downloadAsHwp = (filename: string, textContent: string) => {
    // 만약 다운로드할 내용 알맹이가 없다면 아무 일도 하지 않고 즉시 함수를 종료합니다.
    if (!textContent) return;

    // 원본 텍스트를 손상시키지 않기 위해 변환용 임시 변수에 내용을 복사합니다.
    let formattedText = textContent;

    // 1단계: LaTeX 분수 포맷인 \frac{A}{B}를 찾아내어 한글 표기 표준인 'B분의 A' 형태로 가동식 치환합니다.
    // 정규표현식 매칭을 통해 \frac{1}{2} -> 2분의 1 꼴로 가독성을 바꿉니다.
    formattedText = formattedText.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$2분의 $1');

    // 2단계: LaTeX 거듭제곱 포맷인 x^{2} 또는 x^2를 한글 특수문자 제곱(², ³, ⁴, ⁵) 기호로 보기 좋게 치환합니다.
    formattedText = formattedText.replace(/\^\{?([2345])\}?/g, (match, p1) => {
      const superscripts: { [key: string]: string } = { '2': '²', '3': '³', '4': '⁴', '5': '⁵' };
      return superscripts[p1] || match; // 매칭되는 숫자가 없으면 원래 기호 그대로 둡니다.
    });

    // 3단계: LaTeX 특수 부호 및 곱하기(\times), 나누기(\div), 루트(\sqrt) 코드를 한글 일반 특수 기호(×, ÷, √)로 번역합니다.
    formattedText = formattedText.replace(/\\times/g, '×'); // 곱하기 기호 치환
    formattedText = formattedText.replace(/\\div/g, '÷');   // 나누기 기호 치환
    formattedText = formattedText.replace(/\\sqrt\{([^}]+)\}/g, '√$1'); // 루트 기호 치환 및 내부 숫자 결합

    // 4단계: [가장 중요] 화면 표시용으로 쓰였던 앞뒤 '$' 달러 기호를 전부 공백으로 청소하여 한글 문서에서 글자가 깨끗하게 나오도록 만듭니다.
    formattedText = formattedText.replace(/\$/g, '');

    // 한글(HWP) 프로그램이 한글 깨짐 없이 정상 인코딩을 해석할 수 있도록 바이너리 데이터 블록(Blob)을 생성합니다.
    const blob = new Blob([formattedText], { type: 'application/x-hwp;charset=utf-8' });
    // 브라우저 메모리에 다운로드 전용 가상 링크(a 태그) 부품을 임시로 하나 생성합니다.
    const link = document.createElement('a');
    // 위에서 가공된 깨끗한 데이터 블록을 다운로드 주소(URL)로 변환해 링크의 경로에 주입합니다.
    link.href = URL.createObjectURL(blob);
    // 다운로드될 파일의 기본 이름(예: 쌍둥이_문제지.hwp)을 설정합니다.
    link.download = filename;
    // 생성된 가상 링크를 컴퓨터가 가상으로 클릭하게 명령을 내려 다운로드를 시작시킵니다.
    link.click();
    // 다운로드가 완전히 끝난 후, 컴퓨터 메모리 낭비를 막기 위해 임시 가상 주소를 깔끔하게 소멸시킵니다.
    URL.revokeObjectURL(link.href);
  };

  // 여기서부터는 브라우저 화면에 렌더링될 눈에 보이는 HTML/CSS 레이아웃 영역입니다.
  return (
    // 전체 배경 화면을 부드러운 연회색(bg-gray-50)으로 깔고 세로 정렬 구조를 잡습니다.
    <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
      {/* 화면 맨 상단 중앙에 배치되는 메인 대제목 타이틀 섹션 */}
      <h1 className="text-3xl font-bold text-blue-600 mb-2"> 문제 생성 페이지 (ExamTwin Custom)</h1>
      <p className="text-gray-600 mb-8">화면에서는 수식으로, 한글(HWP)에서는 깨짐 없는 텍스트로 깔끔하게 출제됩니다.</p>

      {/* 3단 가로 분할 레이아웃 시스템을 작동합니다. (모바일 등 화면이 좁아지면 자동으로 세로 정렬로 변경됩니다.) */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 🧱 [왼쪽 1단 박스]: 기출 파일 업로드 및 옵션을 조율하는 컨트롤 패널 구역 */}
        <div className="bg-white p-6 rounded-xl shadow flex flex-col justify-between">
          <div>
            {/* 세부 옵션 안내 문구 */}
            <h2 className="text-lg font-semibold mb-1 text-gray-700">1. 출제 옵션 & 파일 세팅</h2>
            <p className="text-xs text-red-500 font-medium mb-4">※ 오직 PDF 및 HWP 파일만 가능합니다.</p>
            
            {/* 파일을 마우스로 떨어뜨리거나 클릭해서 업로드하는 점선 테두리 디자인의 파일 스테이지 */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition relative mb-4">
              {/* 투명한 진짜 파일 태그인 input을 가득 채워 배치하여 눈에 안 보이지만 마우스 클릭은 감지되도록 연출합니다. */}
              <input type="file" accept=".pdf,.hwp" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <span className="text-3xl mb-1">📁</span>
              {/* 파일이 정상 등록되면 파일명을 띄우고, 비어있으면 기본 문구를 출력하는 유동성 텍스트창입니다. */}
              <p className="text-xs text-gray-600 font-medium text-center truncate w-full">
                {file ? `선택됨: ${file.name}` : '파일을 드래그하거나 클릭하세요'}
              </p>
            </div>

            {/* ✍️ 직접 원하는 문항 숫자를 타이핑해 넣을 수 있는 숫자 입력 인풋 상자 구역 */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">출제 문항 수 입력</label>
              <div className="relative flex items-center">
                {/* 숫자를 타이핑하는 칸입니다. 입력값이 변할 때마다 setCount를 통해 실시간 업데이트합니다. */}
                <input 
                  type="number" 
                  min="1" 
                  max="10" // 고품질 인공지능 답변 유지를 위해 한 번에 최대 30문항 가이드라인을 세웁니다.
                  value={count} 
                  onChange={(e) => setCount(e.target.value)} 
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-blue-500 focus:border-blue-500 text-gray-800 font-bold text-base"
                  placeholder="문제 개수(1~10개)"
                />
                {Number(count) > 10 && (
                  <p className="text-red-500 text-sm">※ 최대 10개까지만 생성할 수 있습니다.</p>
                )}
                {/* 인풋창 내부 우측 끝에 예쁘게 안착하는 '개' 글자 레이블 디자인 */}
                <span className="absolute right-3 text-sm font-medium text-gray-500">개</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">※ AI의 안정적인 집중력을 위해 1~10개 사이를 권장합니다.</p>
            </div>

            {/* 특정 시험 단원 범위만 족집게 출제하고 싶을 때 적는 문자 입력 상자 구역 */}
            <div className="mb-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">특정 출제 파트 (선택)</label>
              <input type="text" placeholder="예: 방정식 단원만, 확률과 통계만 (비우면 전체)" value={part} onChange={(e) => setPart(e.target.value)} className="w-full p-2.5 text-sm bg-gray-50 border rounded-lg focus:outline-blue-500 text-gray-800" />
            </div>
          </div>

          {/* 세팅이 완료되어 최종 서버에 인공지능 연산을 발동시키는 메인 액션 버튼 파트 */}
          {/* 작업이 진행 중이거나 파일이 없을 땐 클릭을 원천 차단(disabled)하도록 안전 로직을 더했습니다. */}
          <button onClick={handleGenerate} disabled={loading || !file} className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition text-sm">
            {loading ? 'AI가 맞춤형 시험지 출제 중...' : '문제 & 해설지 생성 ✨'}
          </button>
        </div>

        {/* 📄 [가운데 2단 박스]: LaTeX 기반 수식 그래픽이 예쁘게 작동하여 출력되는 쌍둥이 문제지 프리뷰 패널 */}
        <div className="bg-white p-6 rounded-xl shadow flex flex-col justify-between">
          <div>
            {/* 프리뷰 상단 헤더 (타이틀과 다운로드 기능 결합) */}
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-gray-700">2. 생성된 문제지</h2>
              {/* 문제 결과물이 도출되기 전에는 클릭을 막아두며, 클릭 시 가공 코드를 거쳐 정제된 HWP 파일이 다운로드됩니다. */}
              <button onClick={() => downloadAsHwp('생성_문제지.hwp', examResult)} disabled={!examResult} className="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-emerald-700 disabled:bg-gray-300">
                📥 HWP 다운로드
              </button>
            </div>
            {/* 수식을 실제 가로선 분수와 예쁜 수학 글꼴로 변환해 스크롤 박스 내에 뿌려줍니다. */}
            <div className="w-full h-[28rem] p-4 bg-gray-50 border rounded-lg overflow-y-auto text-sm text-gray-800 markdown-body">
              {examResult ? (
                // 마크다운 파서 컴포넌트로 텍스트를 감싸 수식 특수코드를 시각 기호로 완벽 렌더링합니다.
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {examResult}
                </ReactMarkdown>
              ) : (
                // 아직 수집된 연산 데이터가 없다면 현재 작업 흐름에 알맞은 실시간 멘트를 띄워줍니다.
                <p className="text-xs text-gray-400">{loading ? 'AI가 기출문제를 분석하여 지정하신 문항 수만큼 출제 중입니다...' : '출제 완료 후 HWP 파일로 다운로드 가능합니다.'}</p>
              )}
            </div>
          </div>
        </div>

        {/* 📝 [오른쪽 3단 박스]: 문제지와 간격 여백을 두고 격리 정렬된 정답 및 친절 풀이집 프리뷰 패널 */}
        <div className="bg-white p-6 rounded-xl shadow flex flex-col justify-between">
          <div>
            {/* 프리뷰 상단 헤더 (타이틀과 해설지 전용 다운로드 기능 결합) */}
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-gray-700">3. 문제 정답 및 해설지</h2>
              {/* 클릭하면 해설집 텍스트가 정제 처리를 거친 후 '쌍둥이_해설지.hwp' 라는 한글 문서로 저장됩니다. */}
              <button onClick={() => downloadAsHwp('문제_해설지.hwp', answerResult)} disabled={!answerResult} className="bg-amber-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-amber-700 disabled:bg-gray-300">
                📥 HWP 다운로드
              </button>
            </div>
            {/* 해설지 프리뷰 스크롤 박스 구역입니다. */}
            <div className="w-full h-[28rem] p-4 bg-gray-50 border rounded-lg overflow-y-auto text-sm text-gray-800 markdown-body">
              {answerResult ? (
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {answerResult}
                </ReactMarkdown>
              ) : (
                // 아직 수집된 연산 데이터가 없다면 현재 작업 흐름에 알맞은 실시간 멘트를 띄워줍니다.
                <p className="text-xs text-gray-400">{loading ? 'AI가 지정된 문항 수에 맞춰 정답과 해설집을 따로 분리하여 작성 중입니다...' : '출제 완료 후 HWP 파일로 다운로드 가능합니다.'}</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
} // 메인 홈 컴포넌트의 끝을 알리는 닫는 대괄호입니다.