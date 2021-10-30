/**
	 * video converter - ECMAScript 6 (OpenCV 를 이용한 비디오 컨버팅 및 안면 인식 연습 프로젝트)
	 * 
	 * 흑백 영상 변환 기능 구현
	 * 안면인식 기능 구현 (모자이크 기능 포함)
	 * 반응형 UI 구현
	 *
	 * index.html 		: file protocol 미지원, http protocol 로 접속 해야함. (모든 브라우저 지원)
     * 
     * 사용한 오픈소스
     *  - opencv v3.4
     *  - jquery v3.6
     *  - bootstrap v4.6.0
	 *
	 * @since 2021.4.15
	 * @author cdhan12@naver.com
	 */

const resource = {
    CONVERTBNWIMG_TITLE: "흑백영상 변환기",
    CONVERTBNWIMG_DISCRIPTION: "원하는 영상 또는 비디오를 선택하면 흑백영상으로 변환되어 출력되고, 다운로드 받을 수 있습니다.",
    CONVERTBNWIMG_CONVNAME: "흑백 변환 영상",
    CONVERTFACEDETECTIMG_TITLE: "안면인식 변환기",
    CONVERTFACEDETECTIMG_DISCRIPTION: "원하는 영상 또는 비디오를 선택하면 영상 속 얼굴을 인식하여 출력되고, 다운로드 받을 수 있습니다.",
    CONVERTFACEDETECTIMG_CONVNAME: "안면인식 영상",
    PLAY_VIDEO: "영상 시작",
    PAUSE_VIDEO: "일시 중지",
    ERROR_CONVERT_FAIL: "인식(변환) 실패",
    ERROR_ONLY_VIDEO: "비디오 파일만 변환할 수 있습니다.",
    ERROR_NOT_READY_FILE: "필요한 파일을 불러오고 있습니다. 잠시후 다시 시도해 주세요."
},
menu = {
    "convertBnWImg": "black_and_white",
    "convertFaceDetectImg": "face_detect"
},
files = {
    "convertBnWImg": {
        defaultConvType: ""
    },
    "convertFaceDetectImg": {
        defaultConvType: "face",
        loaded: false,
        path: "./xml/face/",
        name: "deploy_lowres.prototxt",
        model: "res10_300x300_ssd_iter_140000_fp16.caffemodel"
    }
},
renderPros = {
    isCamera: false,
    orgMat: null,
    convMat: null,
    convType: ""
},
renderMappingCallback = {
    isCamera: enableVideoTypeBtns,
    orgMat: enableCurMenuBtns,
    convMat: enableDisableDownloadBtn,
    convType: ""
},
FPS = 30;

let curMenu = "convertBnWImg",
    self = this,
    streaming = false,
    width, height, cap,
    eleOrgVideo, eleCvtVideo, eleOrgPh, eleCvtPh, eleUploadInput, eleDownload, eleDownloadLink,
    eleCvtText, eleCvtBtnWrap, eleOrgBtnWrap, eleMosaicSel, elesFaceButton, elesVideoType, elesVideoPlayer,
    cvUtils, classifier, faces, netDet;

/**
 * 비디오 변환기 DOM Element 캐싱
 */ 
function cacheElement () {
    eleOrgVideo = document.getElementById("video_org"),
    eleCvtVideo = document.getElementById("video_cvt"),
    eleOrgPh = document.getElementById("ph_org"),
    eleCvtPh = document.getElementById("ph_cvt"),
    eleCvtText = document.getElementById("video_cvt_text"),
    eleCvtBtnWrap = document.getElementById("video_cvt_btn_wrap");
    eleOrgBtnWrap = document.getElementById("video_org_btn_wrap");
    eleUploadInput = document.getElementById("video_upload_input"),
    eleDownloadBtn = document.getElementById("video_download_btn");
    eleDownloadLink = document.getElementById("video_download_link");
    eleMosaicSel = document.getElementById("image_mosaic_select");
    eleLoadingSpinner = document.getElementById("loading_spinner");
    eleConvertContainer = document.getElementsByClassName("cvter_wrap_loading")[0];
    eleConvertMenu = document.getElementsByClassName("cvter_menu")[0];
    elesResource = document.querySelectorAll("[data-res]");
    elesFaceDetect = document.getElementsByClassName("btn_face_detect");
    elesVideoType = document.getElementsByClassName("btn_video_type");
    elesVideoPlayer = document.getElementsByClassName("btn_video_player")[0];
}

/**
 * 현재 메뉴에 필요한 파일(모델 데이터) 로드 실행
 */ 
function loadFiles () {
    const fileInfo = files[curMenu];

    if (fileInfo && fileInfo.name && !fileInfo.loaded) {
        let url = fileInfo.path + fileInfo.name,
            callBack = this[`init${curMenu.substring(0, 1).toUpperCase() + curMenu.substring(1)}`];

        const execData = () => {
            if (fileInfo.model) {
                // 추가로 불러올 모델 파일이 있는 경우, 모델을 불러온 후, 초기화 시작한다.
                cvUtils.createFileFromUrl(fileInfo.model, fileInfo.path + fileInfo.model, () => {
                    netDet = cv.readNetFromCaffe(fileInfo.name, fileInfo.model);
                    callBack();
                });
            } else {
                callBack();
            }
        };

        // 현재 메뉴에 필요한 파일을 불러온다.
        cvUtils.createFileFromUrl(fileInfo.name, url, execData);
    }
}

/**
 * 비디오 사이즈 설정
 * @param {Number} vWidth 
 * @param {Number} vHeight 
 */
function setVideoSize (vWidth, vHeight) {
    const defaultSize = getCameraSize();
    let w = defaultSize.w,
        h = defaultSize.h;

    if (vWidth && vHeight) {
        let ratio = vHeight / vWidth;

        if (vWidth > w) {
            // 비디오 너비가 디폴트값 보다 크면, 디폴트값으로 조정해 준다.
            h = getRoundNumber(w * ratio, 1);
        } else {
            w = vWidth;
            h = vHeight;
        }
    }

    width = w;
    height = h
}

/**
 * 현재 카메라 사이즈 반환
 * @return {Object}
 */
function getCameraSize () {
    const defaultWidth = 538,
        defaultRatio = 0.75,
        eleTarget = (eleCvtPh.style.display === "none") ? eleCvtPh.parentNode : eleCvtPh,
        adjustVal = eleTarget === eleCvtPh ? 0 : -2;

    let w = Math.max(eleTarget.getBoundingClientRect().width + adjustVal, 0);
    w = (w > 0) ? w : defaultWidth;
    // console.log("width : ", w);

    return {
        w,
        h: getRoundNumber(w * defaultRatio, 1)
    };
}

/**
 * 파일 로드 실행이 완료 되었는지 여부 반환 함수
 */ 
function isNotReadyLoadFile () {
    return !!(files[curMenu] && files[curMenu].loaded === false);
}

/**
 * 비디오 변환기 초기화
 */
function initVideoConverter () {
    // 비디오 크기 설정
    setVideoSize();

    // 비디오 컨버터 메뉴 버튼의 click event 바인딩
    eleConvertMenu.addEventListener("click", doMenuClick, false);

    // 영상선택 input 의 click event 바인딩
    eleUploadInput.addEventListener("click", doOrgInputClick, false);

    // 영상선택 input 의 change event 바인딩
    eleUploadInput.addEventListener("change", renderOrgVideo, false);

    // 컨버팅 영역 button 의 click event 바인딩
    eleCvtBtnWrap.addEventListener("click", doButtonClick, false);

    // 원본 영역 button 의 click event 바인딩
    eleOrgBtnWrap.addEventListener("click", doButtonClick, false);

    // 원본 영상 load event 바인딩
    //eleOrgVideo.onload = renderConvertVideo;

    // 변환기 영역 활성화
    eleLoadingSpinner.style.display = "none";
    eleConvertContainer.classList.remove("cvter_wrap_loading");
}

/**
 * 안면인식 변환기 초기화
 */ 
function initConvertFaceDetectImg () {
    // 안면인식 클래스를 초기화 한다.
    // if (!classifier) {
    // 	classifier = new cv.CascadeClassifier();
    // }
    // classifier.load(files[curMenu].name);
    files[curMenu].loaded = true;

    // face 표시용 rectVector 를 생성한다.
    // if (!faces) {
    // 	faces = new cv.RectVector();
    // }
}

/**
 * 메뉴 버튼 클릭 이벤트 콜백
 */ 
function doMenuClick (e) {
    let target = e.target,
        menuName = target.name;

    // 메뉴 변경이 실행되었으면, 요청된 메뉴로 레이아웃을 변경한다.
    if (target.nodeName === "INPUT" && menu[menuName] && menuName !== curMenu) {
        curMenu = menuName;

        // 컨버팅 타입 초기화
        initConvType();
        // 스트리밍이 진행중이면 중단 시킨다.
        stopVideo();
        // 현재 메뉴에 필요한 파일 로드
        loadFiles();
        // 변환기 영역 초기화
        disableConvertArea();
        // 메뉴 전용 버튼 초기화
        visibleMenuBtns(); 
        // 메뉴 레이아웃 리소스 랜더링
        renderMenuResource();
        // 컨버팅 실패 리소스가 있으면 제거한다.
        disableConvertFail();
    }
}

/**
 * 컨버팅 영역 버튼 클릭 이벤트 콜백
 */ 
function doButtonClick (e) {
    let target = e.target,
        btnName = target.name;

    if (btnName === "mosaic" || btnName === "face" || btnName === "extract") {
        // 안면인식, 모자이크 실행
        setRenderProps(null, null, null, btnName);
    } else if (btnName === "download") {
        // 다운로드 실행
        downloadBnWImg();
    } else if (btnName === "camera") {
        // 카메라 실행
        startVideo(true);
    } else if (btnName === "play" || btnName === "pause") {
        self[`${btnName === "play" ? "restart" : btnName}Video`]();
    }
}

/**
 * 원본 영상선택 버튼 클릭 이벤트 콜백
 */ 
function doOrgInputClick (e) {
    // 현재 메뉴의 파일 로드가 완료되지 않았으면, 안내 문구를 출력하고 클릭 요청을 취소한다.
    if (isNotReadyLoadFile()) {
        alert(resource.ERROR_NOT_READY_FILE);
        e.preventDefault();
        return false;
    }

    return true;
}

/**
 * 현재 메뉴 리소스 랜더링
 */ 
function renderMenuResource () {
    // 현재 메뉴에 등록된 리소스 출력을 수행한다.
    for (let resNode of elesResource) {
        let resVal = getResource(resNode);

        if (resVal) {
            resNode.innerHTML = resVal;
        }
    }
}

/**
 * 대상 리소스 노드의 현재 등록된 리소스를 반환
 */ 
function getResource (targetNode) {
    let resName = targetNode ? targetNode.getAttribute("data-res") : "";

    return resource[(resName || "").replace("{menu}", curMenu).toUpperCase()];
}

function initConvType () {
    setRenderProps(false, null, null, files[curMenu].defaultConvType);
}

/**
 * 랜더링 프로퍼티 반환
 */
function getRenderProps () {
    return renderPros;
}

/**
 * 랜더링 프로퍼티 설정
 * @param {boolean} isCamera 
 * @param {object} orgMat 
 * @param {object} convMat 
 * @param {string} convType 
 */
function setRenderProps (isCamera, orgMat, convMat, convType) {
    let callbacks = [];

    if (typeof isCamera === "boolean") {
        if (isCamera !== renderPros.isCamera) {
            callbacks.push({cb: renderMappingCallback.isCamera, val: isCamera});
        }
        renderPros.isCamera = isCamera;
    }
    if (orgMat != null) {
        if ((orgMat || null) !== renderPros.orgMat && !(orgMat && renderPros.orgMat)) {
            callbacks.push({cb: renderMappingCallback.orgMat, val: !orgMat});
        }
        renderPros.orgMat = orgMat || null;
    }
    if (convMat != null) {
        if ((convMat || null) !== renderPros.convMat && !(convMat && renderPros.convMat)) {
            callbacks.push({cb: renderMappingCallback.convMat, val: convMat});
        }
        renderPros.convMat = convMat || null;
    }
    if (convType != null) {
        renderPros.convType = convType;
    }

    for (let cbInfo of callbacks) {
        if (cbInfo.cb) {
            cbInfo.cb(cbInfo.val);
        }
    }
}

/**
 * 랜더링 프로퍼티 클리어(초기화)
 */
function clearRenderProps () {
    if (renderPros.orgMat) {
        renderPros.orgMat.delete();
    }
    if (renderPros.convMat) {
        renderPros.convMat.delete();
    }
    if (faces) {
        //faces.delete();
    }
    if (classifier) {
        //classifier.delete();
    }

    const props = getRenderProps(),
        isCamera = props.isCamera,
        convType = props.convType;

    setRenderProps(isCamera, "", "", convType);
}

/**
 * 스트리밍 상태 반환
 */
function getStreamingStatus () {
    return streaming;
}

/**
 * 스트리밍 상태 설정
 */
function setStreamingStatus (status) {
    streaming = status;
    toggleVideoBtn();
}

/**
 * 카메라 타입 여부 반환
 */
function isCameraType () {
    return getRenderProps().isCamera;
}

/**
 * 비디오 타입 설정
 */
function setVideoType (isCameraType) {
    setRenderProps(isCameraType === true);
}

/**
 * 비디오 셋업
 */
function setupVideo (isCamera) {
    eleOrgVideo.setAttribute("width", width);
    eleOrgVideo.setAttribute("height", height);
    eleCvtVideo.setAttribute("width", width);
    eleCvtVideo.setAttribute("height", height);

    setVideoType(isCamera);
    // enableVideoTypeBtns();
    // enableCurMenuBtns();

    if (eleOrgVideo.style.display === "none") {
        enableConvertArea();
    }
}

/**
 * 비디오 시작
 */
function startVideo (useCamera) {
    // 스트리밍이 진행중이면 중단 시킨다.
    stopVideo();

    if (useCamera) {
        setVideoSize();
        setupVideo(useCamera);
        cvUtils.startCamera(null, startStreaming, "video_org");
    } else {
        eleOrgVideo.addEventListener('loadedmetadata', setupStreaming, false);
        eleOrgVideo.addEventListener('canplay', startStreaming, false);
        eleOrgVideo.play();
    }
}

/**
 * 비디오 중단
 */
function stopVideo () {
    // 스트리밍 진행중이 아니면 중단한다.
    if (!getStreamingStatus()) {
        return;
    }

    if (isCameraType()) {
        cvUtils.stopCamera();
    } else {
        const srcObj = eleOrgVideo.srcObject,
            tracks = srcObj ? eleOrgVideo.srcObject.getTracks() : [];
        tracks.forEach(track => {
            track.stop();
        });

        eleOrgVideo.removeEventListener('loadedmetadata', setupStreaming);
        eleOrgVideo.removeEventListener('canplay', startStreaming);
    }

    setStreamingStatus(false);
}

/**
 * 비디오 일시중지
 */
function pauseVideo () {
    eleOrgVideo.pause();
    setStreamingStatus(false);
}

/**
 * 비디오 다시 시작
 */
function restartVideo () {
    eleOrgVideo.play();
    startStreaming();
}

/**
 * 스트리밍 셋업
 */
function setupStreaming () {
    setVideoSize(eleOrgVideo.videoWidth, eleOrgVideo.videoHeight);
    setupVideo(false);
}

/**
 * 스트리밍 시작
 */
function startStreaming () {
    cap = new cv.VideoCapture(eleOrgVideo);
    setRenderProps(null, new cv.Mat(height, width, cv.CV_8UC4), new cv.Mat(height, width, cv.CV_8UC3));
    
    // 스트리밍 활성화 상태로 업데이트
    setStreamingStatus(true);

    // 실시간 프레임 컨버팅 시작
    setTimeout(renderConvertVideo, 100);
}

/**
 * 선택된 원본 영상 랜더링
 */
function renderOrgVideo (e) {
    const target = e.target,
        validExt = ["mkv", "mp4"];
    let upFile = target ? target.files[0] : null;

    if (upFile) {
        const fInfo = getFileName(upFile.name);

        // 변환 대상이 영상 파일인지 확인한다.
        if (validExt.indexOf((fInfo.fileExt || "").toLowerCase()) !== -1) {
            // 카메라 속성이 있었으면 제거해 준다. (srcObject 이전 속성이 있으면 videoWidth 정보가 비정상적으로 출력될 수 있음)
            if (eleOrgVideo.srcObject) {
                eleOrgVideo.srcObject = null;
            }
            // 파일이 정상이면 컨버팅 영역을 활성화 시키고, 그림 파일을 랜더링하여 컨버팅을 시작한다.
            eleOrgVideo.src = URL.createObjectURL(upFile);
            
            // 컨버팅 시작
            startVideo(false);
        } else {
            // 영상 파일만 가능하다는 안내 문구 출력
            alert(`${resource.ERROR_ONLY_VIDEO} \n(${validExt.join(' , ')})`);
        }

        // 처리 완료 후 값 클리어
        clearInputVal();
    }
}

/**
 * 원본 영상 랜더링에 따른 현재 메뉴의 컨버팅 수행
 */ 
function renderConvertVideo () {
    const rInfo = getRenderProps();
    let orgMat = rInfo.orgMat,
        convMat = rInfo.convMat,
        convType = rInfo.convType || "",
        begin = Date.now(),
        defaultDelay = 24,
        delay;

    // 스트리밍 상태가 아니면 종료한다.
    if (!getStreamingStatus()) {
        clearRenderProps();
        return;
    }

    // 현재 프레임을 가져와서, 현재 메뉴의 바인딩 컨버팅 함수 실행
    cap.read(orgMat);
    self[curMenu](orgMat, convMat, convType);

    // 프레임 계속 처리 (재귀 호출)
    delay = 1000/FPS - (Date.now() - begin);
    delay = delay < 0 ? defaultDelay : delay;
    // console.log(delay);
    setTimeout(renderConvertVideo, delay);
}

/**
 * 흑백영상 컨버팅 후 랜더링
 */
function convertBnWImg (orgImgMat, convImgMat, convType) {
    cv.cvtColor(orgImgMat, convImgMat, cv.COLOR_RGB2GRAY, 0);
    cv.imshow(eleCvtVideo, convImgMat);
}

/**
 * 안면인식 컨버팅 후 랜더링
 */
function convertFaceDetectImg (orgImgMat, convImgMat, convType) {
    // Frame 을 BGR 로 변경
    cv.cvtColor(orgImgMat, convImgMat, cv.COLOR_RGBA2BGR);
    // face detect
    faces = detectFaces(convImgMat);

    let len = faces.length;
    if (len > 0) {
        // 컨버팅 실패 리소스가 있으면 제거한다.
        //disableConvertFail();

        // 검출된 안면인식 갯수만큼 돌면서 타입별 컨버팅을 진행한다.
        for (let i = 0; i < len; i++) {
            //const face = faces.get(i);
            const face = faces[i];
            let startPoint, endPoint, mosaicRatio;
                
            if (convType === "mosaic") {
                // 모자이크 처리
                mosaicRatio = eleMosaicSel.value;
                orgImgMat = addPicture(orgImgMat, makeMosaicImg(orgImgMat.roi(face), parseFloat(mosaicRatio)), face.x, face.y);
            } else if (convType === "extract") {
                // 안면인식 추출 처리 (UI상 1개의 안면인식만 처리한다.)
                if (i === 0) {
                    orgImgMat = orgImgMat.roi(face);
                    cv.resize(orgImgMat, orgImgMat, convImgMat.size(), 0, 0, cv.INTER_NEAREST);
                    break;
                }
            } else {
                // 안면인식 처리 (빨간색 사각 처리)
                startPoint = new cv.Point(face.x, face.y);
                endPoint = new cv.Point(face.x + face.width, face.y + face.height);
                cv.rectangle(orgImgMat, startPoint, endPoint, [255, 0, 0, 255]);
            }
        }
    } else {
        // 컨버팅 실패 리소스를 출력한다.
        //enableConvertFail();
    }

    // 컨버팅 그림을 출력하고 매트릭스 정보는 제거한다.
    cv.imshow(eleCvtVideo, orgImgMat);
}

/**
 * 안면 디텍팅 (실행 결과 반영한 이미지 메트릭스 값 반환)
 * @param {object} img 
 * @returns 
 */
function detectFaces(img) {
    let blob = cv.blobFromImage(img, 1, { width: 192, height: 144 }, [104, 117, 123, 0], false, false),
        faces = [],
        out;
    
    netDet.setInput(blob);
    out = netDet.forward();

    for (let i = 0, n = out.data32F.length; i < n; i += 7) {
        let confidence = out.data32F[i + 2],
            left = out.data32F[i + 3] * img.cols,
            top = out.data32F[i + 4] * img.rows,
            right = out.data32F[i + 5] * img.cols,
            bottom = out.data32F[i + 6] * img.rows;
        
        left = Math.min(Math.max(0, left), img.cols - 1);
        right = Math.min(Math.max(0, right), img.cols - 1);
        bottom = Math.min(Math.max(0, bottom), img.rows - 1);
        top = Math.min(Math.max(0, top), img.rows - 1);

        if (confidence > 0.5 && left < right && top < bottom) {
            faces.push({ x: left, y: top, width: right - left, height: bottom - top })
        }
    }

    blob.delete();
    out.delete();

    return faces;
};

/**
 * 모자이크 생성 (생성한 값 반영하여 이미지 메트릭스 값 반환)
 * @param {object} orgImgMat 
 * @param {number} ratio 
 * @returns 
 */
function makeMosaicImg (orgImgMat, ratio = 0.1) {
    let convImgMat = new cv.Mat(),
        noneSize = new cv.Size(),
        dSize = orgImgMat.size();

    cv.resize(orgImgMat, convImgMat, noneSize, ratio, ratio, cv.INTER_NEAREST);
    cv.resize(convImgMat, convImgMat, dSize, 0, 0, cv.INTER_NEAREST);

    return convImgMat;
}

/**
 * 그림 추가 (추가한 그림값 반영한 이미지 메트릭스 값 반환)
 * @param {object} orgImgMat 
 * @param {object} addImgMat 
 * @param {number} x 
 * @param {number} y 
 * @returns 
 */
function addPicture (orgImgMat, addImgMat, x, y) {
    for (let i = 0; i < addImgMat.rows; i++) {
        for (let j = 0; j < addImgMat.cols; j++) {
            let posY = y + i,
                posX = x + j;

            orgImgMat.ucharPtr(posY, posX)[0] = addImgMat.ucharPtr(i, j)[0];
            orgImgMat.ucharPtr(posY, posX)[1] = addImgMat.ucharPtr(i, j)[1];
            orgImgMat.ucharPtr(posY, posX)[2] = addImgMat.ucharPtr(i, j)[2];
            orgImgMat.ucharPtr(posY, posX)[3] = addImgMat.ucharPtr(i, j)[3];
        }
    }

    return orgImgMat;
}

function downloadBnWImg () {
    eleDownloadLink.setAttribute("download", `${menu[curMenu]}_${(new Date).getTime()}.png`);
    eleDownloadLink.setAttribute("href", eleCvtVideo.toDataURL("image/png").replace("image/png", "octet-stream"));
}

function getFileName (path) {
    const isWindows = (navigator.userAgent.toLowerCase().indexOf("windows") !== -1),
        osSeparator = isWindows ? "\\" : "/";

    let fileName = "",
        fileExt = "",
        tmpFileName, fullName, idxExt;

    if (!isWindows && /fakepath/i.test(path) && /\\/.test(path)) {
        osSeparator = "\\";
    }

    try {
        // Path 를 분리하여 파일명과 확장자를 추출한다.
        tmpFileName = path.split(osSeparator)
        fullName = tmpFileName[tmpFileName.length - 1];
        idxExt = fullName.lastIndexOf(".");

        if (idxExt === -1) {
            fileName = fullName;
        } else {
            fileName = fullName.substring(0, idxExt);
            fileExt = fullName.substring(idxExt + 1);
        }
    } catch(excep) {}

    // 추출된 파일명과 확장자 반환
    return {
        "fileName" : fileName,
        "fileExt" : fileExt
    };
}

function getRoundNumber(number, limit = 4) {
    const limitNumber = Math.pow(10, limit);

    return Math.round(number * limitNumber) / limitNumber;
};

function getUCFirst(str) {
    if (!str) {
        return "";
    }

    return str.substring(0, 1).toUpperCase() + str.substring(1);
};

function getCamelCase (str) {
    if (!str || typeof str !== "string") {
        return str;
    }

    let rename = str;

    const __convertCamelCase = (arrStr) => {
        let convStr = "";

        for (const [i, name] of arrStr.entries()) {
            convStr += (i === 0) ? name : getUCFirst(name);
        }

        return convStr;
    };

    if (rename.indexOf("-") !== -1) {
        rename = __convertCamelCase(rename.split("-"));
    }

    if (rename.indexOf("_") !== -1) {
        rename = __convertCamelCase(rename.split("_"));
    }

    return rename;
}

function getPascalCase (str) {
    let rename = getCamelCase(str);

    return (str !== rename) ? getUCFirst(rename) : str;
}

function clearInputVal () {
    eleUploadInput.value = "";
}

function clearCanvas () {
    const ctx = eleCvtVideo.getContext('2d');

    // 픽셀 정리
    ctx.clearRect(0, 0, eleCvtVideo.width, eleCvtVideo.height);
    // 컨텍스트 리셋
    ctx.beginPath();
}

function enableConvertArea () {
    eleOrgPh.style.display = "none";
    eleCvtPh.style.display = "none";
    eleOrgVideo.style.display = "block";
    eleCvtVideo.style.display = "block";
    clearCanvas();
    enableDisableVideoBtn(true);
}

function disableConvertArea () {
    eleOrgPh.style.display = "";
    eleCvtPh.style.display = "";
    eleOrgVideo.style.display = "none";
    eleCvtVideo.style.display = "none";
    clearInputVal();
    enableDisableVideoBtn(false);
}

function enableConvertFail () {
    eleCvtText.style.color = "#dc3545";
    eleCvtText.innerHTML = `${getResource(eleCvtText)} (${resource.ERROR_CONVERT_FAIL})`;
}

function disableConvertFail () {
    if (eleCvtText.style.color) {
        eleCvtText.style.color = "";
        eleCvtText.innerHTML = getResource(eleCvtText);
    }
}

function enableVideoTypeBtns (isCameraType) {
    const videoType = isCameraType ? "camera" : "video";
    //console.log(`enableVideoTypeBtns : ${videoType}`);

    // video type 이 camera 일때 버튼의 상태를 업데이트 한다.
    for (let btnArea of elesVideoType) {
        let name = btnArea.getAttribute("name");

        if (name === "camera") {
            setDisableAttrForMenuBtns(btnArea, name === videoType);
        }
    }
}

function visibleMenuBtns () {
    for (let key in menu) {
        let curMenuBtns = self[`eles${getPascalCase(menu[key])}`],
            disp = key === curMenu ? "block" : "none";

        if (curMenuBtns) {
            for (let btnArea of curMenuBtns) {
                btnArea.style.display = disp;

                if (disp === "block") {
                    setDisableAttrForMenuBtns(btnArea, true);
                }
            }
        }
    }
}

function enableCurMenuBtns (isDisable) {
    let curMenuBtns = self[`eles${getPascalCase(menu[curMenu])}`] || [];

    for (let btnArea of curMenuBtns) {
        setDisableAttrForMenuBtns(btnArea, isDisable);
        //console.log(btnArea.class);
    }
}

function setDisableAttrForMenuBtns (btnArea, isDisable) {
    let btns = btnArea.nodeName === "BUTTON" ? [btnArea] : btnArea.querySelectorAll("button, select, input");

    for (let btn of btns) {
        //console.log(`${btn.getAttribute("name")} is Disable : `, isDisable);
        if (isDisable === true) {
            btn.setAttribute("disabled", "disabled");
        } else {
            btn.removeAttribute("disabled");
        }
    }
}

function enableConvertBtn () {
    eleUploadInput.removeAttribute("disabled");
}

function enableDisableDownloadBtn (isEnable) {
    if (isEnable) {
        eleDownloadBtn.removeAttribute("disabled");
        //console.log("enable download button");
    } else {
        eleDownloadBtn.setAttribute("disabled", "disabled");
        // console.log("disable download button");
    }
}

function enableDisableVideoBtn (isEnable) {
    if (isEnable) {
        elesVideoPlayer.removeAttribute("disabled");
    } else {
        elesVideoPlayer.setAttribute("disabled", "disabled");
    }
}

function toggleVideoBtn () {
    const status = streaming ? "pause" : "play";

    elesVideoPlayer.setAttribute("name", status);
    elesVideoPlayer.innerHTML = resource[`${status.toUpperCase()}_VIDEO`];
}

/**
 * openCV 초기화 및 DOM 초기화
 */
function onOpenCvReady () {
    cv.onRuntimeInitialized = () => {
        // cv utils class 생성
        cvUtils = new Utils("errorMessage");

        // DOM Element 캐싱
        cacheElement();
        // 영상선택 버튼 활성화
        enableConvertBtn();
        // 메인메뉴에 필요한 파일 로드
        loadFiles();
        // 영상 변환기 초기화 실행
        initVideoConverter();
    }
}