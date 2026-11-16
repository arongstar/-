// 교안 원문(마크다운)에서 실습·프롬프트 개수를 셉니다.
export function lessonStats(body: string, materials: number) {
  return {
    // '### ✋ …' 실습 카드와, 단원 전체가 실습인 '## 5. ✋ …' 제목을 함께 셈
    practices: (body.match(/^(###\s*✋|##\s+(\d+\.\s*)?✋)/gm) || []).length,
    prompts: (body.match(/^```prompt/gm) || []).length,
    materials,
  };
}
