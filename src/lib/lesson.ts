// 교안 원문(마크다운)에서 실습·프롬프트 개수를 셉니다.
export function lessonStats(body: string, materials: number) {
  return {
    practices: (body.match(/^###\s*✋/gm) || []).length,
    prompts: (body.match(/^```prompt/gm) || []).length,
    materials,
  };
}
