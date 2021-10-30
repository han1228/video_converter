## video converter - ECMAScript 6

OpenCV 를 이용한 비디오 컨버팅 및 안면 인식 연습 프로젝트

### ECMAScript 6 (Vanilla JS)

1. 기능
    * 흑백 영상 변환 기능 구현
	* 안면인식 기능 구현 (모자이크 기능 포함)
	* 반응형 UI 구현
    * 기능 위주의 프로토타입으로 구조 없이 구현 진행함

2. 실행
    * index.html : 비디오 컨버터, file protocol 미지원, http protocol 로 접속 해야함. (모든 브라우저 지원)

3. 설명
    * js/video_converter.js : 초기화, 비디오 컨버팅, 안면 인식, 모자이크

4. 사용한 오픈소스
    * opencv v3.4
    * jquery v3.6
    * bootstrap v4.6.0