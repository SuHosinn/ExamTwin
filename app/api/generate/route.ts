// 구글 Gemini AI를 사용하기 위해 최신 구글 공식 SDK 도구와 데이터 스키마 타입을 불러옵니다.
import { GoogleGenAI, Type } from '@google/genai';
// Next.js 웹 서버가 브라우저(화면)로 결과나 에러를 응답할 때 사용하는 핵심 도구를 불러옵니다.
import { NextResponse } from 'next/server';

// .env.local(금고 파일)에 저장해 둔 구글 API 키를 꺼내와서 Gemini AI 전용 소통 비서(ai)를 깨웁니다.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 화면단에서 POST 방식(데이터 전송)으로 요청이 들어왔을 때 가동되는 메인 서버 함수를 작동시킵니다.
export async function POST(request: Request) {
  // 코드를 가동하다가 어떤 종류의 에러든 발생하면 사이트가 터지지 않고 안전하게 수습하도록 try-catch 문을 엽니다.
  try {
    
    // 1. 화면(page.tsx)에서 보따리에 싸서 보낸 파일, 문항 수, 단원 정보를 접수하여 변수에 담습니다.
    const formData = await request.formData(); // 전송된 폼 데이터 보따리를 통째로 받아옵니다.
    const file = formData.get('file') as File; // 보따리 안에서 'file'이라는 이름표가 붙은 파일 원본을 꺼냅니다.
    const count = formData.get('count') as string; // 사용자가 직접 타이핑해서 넘겨준 '원하는 문항 수' 글자를 꺼냅니다.
    const part = formData.get('part') as string;   // 사용자가 지정한 '출제 파트' 글자를 꺼냅니다.

    // 만약 파일 정보가 비어있거나 제대로 전송되지 않았다면 에러를 내뿜고 차단합니다.
    if (!file) {
      // 브라우저 화면단에 실패 사유와 함께 400 에러 코드를 즉시 돌려보냅니다.
      return NextResponse.json({ error: '파일이 유실되었거나 전송되지 않았습니다.' }, { status: 400 });
    }

    // 2. 파일 확장자를 파악하고 구글 AI가 읽을 수 있도록 문자열 데이터 형태(Base64)로 인코딩합니다.
    // 파일 이름(예: exam.pdf)을 점('.') 기준으로 쪼갠 뒤 맨 마지막 확장자만 추출해 소문자로 통일합니다.
    const ext = file.name.split('.').pop()?.toLowerCase();
    // 업로드된 실제 이진 파일 데이터를 자바스크립트가 메모리에서 다룰 수 있는 이진 배열(ArrayBuffer)로 변환합니다.
    const arrayBuffer = await file.arrayBuffer();
    // 이진 데이터를 구글 AI 서버로 안전하게 건너갈 수 있도록 영문+숫자 혼합 문자열 형태(Base64)로 암호화합니다.
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    // 확장자가 pdf면 'application/pdf'를, 그 외 hwp 파일 등은 임시 텍스트 형태 'text/plain' 이름표를 붙입니다.
    const mimeType = ext === 'pdf' ? 'application/pdf' : 'text/plain';

    // 3. 줄바꿈 여백, 원문자 보기(①~④), 해설지 문단 정렬을 엄격하게 강제하는 초정밀 지시서(프롬프트)를 작성합니다.
    const systemContent = `너는 대한민국 최고의 고등학교 검정고시 전문 출제위원장이야.
    제공되는 기출문제 파일을 정밀하게 분석하여, 사용자가 지정한 [출제 파트] 내에서 난이도와 유형이 비슷한 문제를 정확히 [출제 문항 수]만큼 새로 제작해줘.
    
    [출제 문항 수]: ${count}개
    [출제 파트]: ${part}

    ⚠️ [매우 중요 - 정식 수학 수식 표현 규칙: LaTeX 문법 엄수]
    - 모든 수학/과학 문제의 변수, 식, 숫자 기호는 텍스트(1/2, x^2)로 쓰지 말고, 반드시 전 세계 수학 표준인 LaTeX 문법을 사용해 앞뒤를 '$' 기호로 묶어서 표현해줘.
    - 변수 및 문자 단독 표현: 단순 문자 x 나 y도 무조건 '$x$', '$y$' 형태로 표현해줘.
    - 분수 표현: 1/2 처럼 슬래시 기호를 쓰지 말고, 위아래로 깔끔하게 나뉘는 '$\\frac{1}{2}$' 또는 '$\\frac{분자}{분모}$' 꼴로만 작성해줘.
    - 거듭제곱(지수) 표현: x^2 이나 x^3 대신 우측 상단에 작게 달라붙는 '$x^{2}$', '$x^{3}$' 포맷으로만 작성해줘.

    ⚠️ [필수 포맷팅 및 가독성 규칙 - 가독성 극대화]
    1. exam (문제지 내용 규칙):
       - 문제와 문제 사이에는 반드시 두 번의 줄바꿈(\\n\\n) 또는 빈 줄을 넣어 문제끼리 다닥다닥 붙지 않게 공간을 넉넉히 띄워줘.
       - 객관식 보기는 1), 2) 대신 반드시 한국 시험지 표준인 원문자 ①, ②, ③, ④ 를 사용해줘.
       - 보기 역시 한 줄에 뭉치지 말고, 가독성을 위해 각 보기마다 줄바꿈을 적용해 정갈하게 나열해줘.
         (예시 표기 방법)
         1. 다음 식을 만족하는 $x$의 값은?
         ① $2$
         ② $4$
         ③ $6$
         ④ $8$

       - 여기에는 정답이나 해설 단어는 절대 노출하지 마.
       
    2. answer (해설지 내용 규칙):
       - 해설지 역시 다닥다닥 붙여 쓰지 말고, 문항마다 확연히 구분되도록 빈 줄을 넣어줘.
       - 각 문항의 해설은 아래 가이드라인 포맷을 엄격히 지켜서 출력해줘. 문장마다 흐름에 맞춰 적절히 줄바꿈을 해줘서 가독성을 높여야 해.
         (예시 표기 방법)
         ■ [문제 1번]
         - 정답: ③
         - 상세 풀이: 
           주어진 조건식에 따라 변수를 이항하면 다음과 같은 식을 얻을 수 있습니다.
           $2x = 12$
           따라서 양변을 $2$로 나누면 $x = 6$이 되므로 정답은 ③번입니다.
           
         ■ [문제 2번]
         ...`;

    // 4. 조립된 명령서 텍스트와 변환된 Base64 파일 덩어리를 구글 규격에 맞는 바구니(배열)에 담습니다.
    const contentsPayload = [
      {
        role: 'user', // 명령을 내리는 주체인 사용자의 역할을 부여합니다.
        parts: [
          { text: systemContent }, // 첫 번째 부품: 수식 및 가독성 규칙이 명시된 마스터 임무 지시서
          {
            inlineData: {
              mimeType: mimeType,    // 두 번째 부품의 형식: PDF 또는 텍스트 이름표
              data: base64Data       // 두 번째 부품의 알맹이: 인코딩된 파일 데이터 원본
            }
          }
        ]
      }
    ];

    // 5. 구글 인공지능 제미나이 2.5 플래시 엔진에게 바구니를 통째로 전달하고, 결과를 칼같이 쪼개진 JSON 구조로 받아옵니다.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // 구글 최신 규격 표준 플래시 모델명을 명시합니다.
      contents: contentsPayload, // 위에서 완성한 명령어와 파일 데이터 조합 패키지를 전달합니다.
      config: {
        // AI가 쓸데없는 수다를 떨지 못하도록 결과물 포맷을 강제로 JSON 형식으로 지정합니다.
        responseMimeType: 'application/json',
        // 넘겨받을 JSON 데이터의 이름과 내부 타입을 명밀하게 설계합니다.
        responseSchema: {
          type: Type.OBJECT, // 전체 결과물은 하나의 큰 중괄호 객체 덩어리여야 합니다.
          properties: {
            // 이 안에 'exam'이라는 이름으로 문제지 글자 상자를 만듭니다.
            exam: { 
              type: Type.STRING, 
              description: "문제 간 여백이 충분하고 보기가 ①~④ 원문자로 정렬된 쌍둥이 문제지 텍스트" 
            },
            // 이 안에 'answer'라는 이름으로 해설지 글자 상자를 만듭니다.
            answer: { 
              type: Type.STRING, 
              description: "문항별로 줄바꿈과 여백이 잘 적용되어 읽기 편한 친절한 풀이 과정 해설지 텍스트" 
            }
          },
          required: ['exam', 'answer'] // 두 상자는 무조건 데이터를 가득 채워서 돌려달라고 강력하게 규제합니다.
        }
      }
    });

    // 6. 구글 AI가 보내온 날것의 JSON 글자 보따리를 꺼냅니다.
    const jsonText = response.text;
    // 만약 모종의 이유로 데이터가 텅 비어서 넘어왔다면 즉시 예외(에러)를 던져 catch 문으로 보냅니다.
    if (!jsonText) throw new Error('구글 AI로부터 수신된 결과 데이터가 비어있습니다.');
    
    // 정상적으로 넘어온 JSON 글자 덩어리를 자바스크립트가 읽을 수 있는 진짜 데이터 객체로 변환합니다.
    const resultData = JSON.parse(jsonText);

    // 7. 문제지(exam)와 해설지(answer) 두 덩어리를 화면단(page.tsx)의 fetch 결과물로 안전하게 반환합니다.
    return NextResponse.json({
      exam: resultData.exam,
      answer: resultData.answer
    });

  // try 블록 안의 코드를 실행하다가 네트워크 단절, 오타, 구글 서버 마비 등 무슨 에러든 터지면 이쪽으로 순간 이동합니다.
  } catch (error) {
    // 내 컴퓨터 VS Code 검은 터미널 창에 어떤 줄에서 왜 에러가 났는지 상세 원인을 기록합니다.
    console.error('서버 수학 수식 마스터 업그레이드 구동 중 에러 발생:', error);
    // 브라우저 화면이 완전히 뻗지 않도록 예쁜 에러 안내 문구와 함께 서버 실패 코드(500)를 화면단으로 전달합니다.
    return NextResponse.json({ error: '수식 양식으로 문제를 생성하는 도중 내부 오류가 발생했습니다.' }, { status: 500 });
  }
} // 대장 함수(POST)를 완벽하게 차단하고 마감하는 가장 바깥쪽 마지막 중괄호입니다.