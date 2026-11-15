# 앱별 코드를 내려받기용 zip 으로 묶어 public/files/apps-script 에 넣습니다.
import zipfile, os
APPS = {
  'A-device-rental': ('A_태블릿대여반납', '태블릿 대여·반납 기록부', '나', '우리 학교 도메인의 모든 사용자', '15yMrhgUrAWloIGj_78TcMHvd3OAD3FQdm_03pBwVNEc'),
  'B-learning-log': ('B_배움기록장_평가대시보드', '배움 기록장 + 평가 대시보드', '나', '우리 학교 도메인의 모든 사용자', '1y-Y3cM5c4z9ZePQ9kk7NZagEF1x2FXvj-1Skz88vDio'),
  'C-observation': ('C_수업관찰체크', '수업 관찰 체크 (교사 전용)', '나', '나만', '11xE374pLQ0HGhwkg8jvKeCk9CCFVNVYLtkObMqu388Y'),
  'D-reading-log': ('D_독서기록장', '우리 반 독서 기록장', '나', '우리 학교 도메인의 모든 사용자', '1mBzeBOCm9DNVzSnab87kYOLI-7hVw7HfqTmb9P05ozQ'),
}
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'public', 'files', 'apps-script')
os.makedirs(out, exist_ok=True)
allzip = zipfile.ZipFile(os.path.join(out, '앱스스크립트_웹앱_4종.zip'), 'w', zipfile.ZIP_DEFLATED)
for d, (name, title, run, access, sid) in APPS.items():
    guide = f"""{title}
=====================
1) 시트 양식 사본 만들기: https://docs.google.com/spreadsheets/d/{sid}/copy
2) 사본에서 [확장 프로그램 → Apps Script]
3) Code.gs 내용을 지우고 이 폴더의 Code.gs 를 붙여 넣기
4) [+ → HTML] 로 'Index' 파일을 만들고 Index.html 을 붙여 넣기 → 저장
5) [배포 → 새 배포 → 웹 앱]
   - 다음 사용자 인증 정보로 실행: {run}
   - 액세스 권한이 있는 사용자: {access}
6) 권한 승인 후 나온 웹 앱 URL 을 사용 (코드를 고치면 배포 관리 → 수정 → 새 버전)
"""
    with zipfile.ZipFile(os.path.join(out, name + '.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
        for f in ['Code.gs', 'Index.html']:
            z.write(os.path.join(here, d, f), f'{name}/{f}')
            allzip.write(os.path.join(here, d, f), f'{name}/{f}')
        z.writestr(f'{name}/사용법.txt', guide)
        allzip.writestr(f'{name}/사용법.txt', guide)
allzip.close()
print(sorted(os.listdir(out)))
