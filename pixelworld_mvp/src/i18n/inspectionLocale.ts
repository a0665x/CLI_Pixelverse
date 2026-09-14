const catalog={
 'zh-TW':{controls:'WASD 移動 · Space 小跳 · L 手電筒',perch:'Space 跳躍 · WASD 空中移動 · 落地後可再跳',gaits:'R 切換速度',walk:'走路',hop:'跳躍',bound:'四肢跑',role:'巡檢員',event:'互動事件',ask:'要查看正在執行的動作嗎？',screen:'電腦工作站',inspect:'查看動作',continue:'繼續巡檢',near:'已進入互動範圍'},
 'en-US':{controls:'WASD move · Space jump · L flashlight',perch:'Space jump · WASD air control · Land to jump again',gaits:'R changes speed',walk:'Walk',hop:'Hop',bound:'Bound',role:'Inspector',event:'Interaction available',ask:'View the current activity?',screen:'Computer workstation',inspect:'View activity',continue:'Keep exploring',near:'You are in interaction range'},
 'ja-JP':{controls:'WASD 移動 · Space ジャンプ · L 懐中電灯',perch:'Space ジャンプ · WASD 空中移動 · 着地して再ジャンプ',gaits:'R で速度切替',walk:'歩く',hop:'ホップ',bound:'四足走行',role:'巡回員',event:'インタラクション',ask:'現在の作業を確認しますか？',screen:'コンピューター',inspect:'作業を見る',continue:'巡回を続ける',near:'操作できる範囲に入りました'},
 'ko-KR':{controls:'WASD 이동 · Space 점프 · L 손전등',perch:'Space 점프 · WASD 공중 이동 · 착지 후 다시 점프',gaits:'R 속도 변경',walk:'걷기',hop:'점프',bound:'네발 달리기',role:'순찰원',event:'상호작용 가능',ask:'현재 작업을 확인할까요?',screen:'컴퓨터 워크스테이션',inspect:'작업 보기',continue:'계속 순찰',near:'상호작용 범위에 들어왔습니다'},
};
export const inspectionCopy=()=>catalog[document.documentElement.lang as keyof typeof catalog]??catalog['en-US'];
