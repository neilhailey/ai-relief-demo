// ── Lightweight i18n — no external library needed ────────────────────────────

export type Lang = 'en' | 'zh'

export const TRANSLATIONS = {
  en: {
    // ── App / header ───────────────────────────────────────────────────────
    appTagline:        'AI Relief',
    signIn:            'Sign in',
    signOut:           'Sign out',
    recent:            'Recent',
    langLabel:         '中文',

    // ── Flow cards ────────────────────────────────────────────────────────
    aiRelief:          'AI Relief',
    aiReliefDesc:      'Describe anything — AI generates an image then carves it into a flat relief panel',
    uploadImage:       'Upload Image',
    uploadImageDesc:   'Use your own photo or artwork — AI enhances it then converts to a carved relief',
    full3dModel:       'Full 3D Model',
    full3dModelDesc:   'Describe any object — AI builds a complete 3D mesh for rotary CNC or printing',

    // ── Step labels ───────────────────────────────────────────────────────
    stepDescribe:      'Describe',
    stepGenerate:      'Generate',
    stepConvert:       'Convert',
    stepPreview:       'Preview',
    stepChoose:        'Choose',
    stepRelief:        'Relief',

    // ── AI Relief prompt step ─────────────────────────────────────────────
    describeDesign:    'Describe your design',
    describeHint:      "Type any idea — we'll generate two images and turn your favourite into a carveable 3D relief STL, ready for your CNC machine.",
    generateImages:    '✦ Generate Images',
    tryExample:        'Try an example:',
    alreadyHaveImage:  'Already have an image?',
    uploadYourOwn:     'Upload your own →',

    // ── Upload step ───────────────────────────────────────────────────────
    uploadTitle:       'Upload your image',
    uploadSubtitle:    "Upload any artwork, photo, or logo — we'll AI-enhance it for carving and convert it to a 3D relief STL ready for your CNC.",
    uploadDropHint:    'Drop, Paste, or Click to upload',
    uploadFormats:     'Supports JPEG, PNG, WEBP, GIF, BMP, TIFF · up to 30 MB',
    uploadHint:        'JPG, PNG or WebP · max 30 MB',
    uploadDrop:        'Drop image here or click to browse',
    uploadAnalysing:   'Analysing your image…',
    uploadUsually:     'usually a few seconds',
    uploadErrType:     'Please upload an image file (JPEG, PNG, WEBP, etc.)',
    uploadErrSize:     'File too large — max 30 MB',
    uploadFailed:      'Upload failed',
    preferAi:          'Prefer to let AI create an image?',
    generateHere:      'Generate it here',

    // ── Select step ───────────────────────────────────────────────────────
    chooseImage:       'Choose your favourite',
    yourPrompt:        'Your prompt:',
    promptEnhanced:    'Prompt was enhanced for better results',
    hideEnhanced:      'Hide enhanced prompt',
    generatingVars:    'Generating new variations…',
    usuallyTime:       'usually 15–25 s',
    selectedCheck:     '✓ Selected',
    selectThis:        'Select this one →',
    variation:         (n: number) => `Variation ${n}`,
    regenerateBoth:    '↺  Regenerate both',
    regenerate:        '↺ Regenerate',
    generatingDots:    'Generating…',
    enhanced:          'Enhanced prompt:',

    // ── Enhance step ──────────────────────────────────────────────────────
    enhanceTitle:      'Enhance for carving',
    enhanceSubtitle:   'AI converts your image into a sculptural depth map — boosting detail and contrast so every cut comes out crisp.',
    detected:          'Detected:',
    labelOriginal:     'ORIGINAL',
    labelEnhanced:     '✦ ENHANCED',
    convertingStyle:   'Converting to sculpture style…',
    useOriginal:       'Use Original',
    useEnhanced:       'Use Enhanced →',
    skipEnhancement:   'Skip Enhancement',
    enhanceBtn:        '✦  Enhance for Carving',
    enhancing:         'Enhancing…',
    featureSharpen:    'Sharpen Details',
    featureClarity:    'Improve Clarity',
    featureDefinition: 'Add Definition',

    // ── Preview step ──────────────────────────────────────────────────────
    previewTitle:      'Preview your relief',
    previewLead:       'Take a peek, tweak if you like…',
    createRelief:      'Create 3D Relief',
    createModel:       '✦  Create Model',
    removeBg:          'Remove Background',
    back:              '← Back',
    previewNote:       'Creates a heightmap + converts to printable STL relief',

    // ── Relief step ───────────────────────────────────────────────────────
    reliefReady:       '3D Relief ready',
    downloadRelief:    'Download STL',
    downloadHeightmap: 'Download Heightmap',
    downloadImage:     'Download Image',
    depth:             'Depth',
    detail:            'Detail',
    smooth:            'Smooth',
    sliderScaleZ:      'Scale Z',
    sliderDetail:      'Detail Enhancement',
    sliderReplace:     'Replace Below',
    sliderDraft:       'V-Bit Draft Angle',
    draftHint:         "Match to your bit's half-angle (60° bit → 30°)",
    draftOff:          'off',
    editHeightCurve:   'Edit Height Curve',
    scaleHeightsY:     'Scale Heights Along Y-Axis',
    scaleHeightsX:     'Scale Heights Along X-Axis',
    heightmapLabel:    'Heightmap',
    updatingStl:       'Updating STL…',
    startOverBtn:      '↺ Start over',
    dragOrbit:         'drag to orbit · scroll to zoom',

    // ── 3D model prompt step ──────────────────────────────────────────────
    generate3dTitle:   'Generate a 3D object',
    generate3dHint:    'Describe any object — AI builds a complete 3D mesh you can carve on a rotary CNC, 4th-axis setup, or send straight to a 3D printer.',
    generate3dBtn:     '✦ Generate 3D Model',
    full3dMeshNote:    'Full 3D mesh',
    full3dMeshDesc:    'Outputs STL (CNC / printing). Best with a rotary axis or 4-axis CNC. For flat-panel relief carving, use the AI Relief flow instead.',
    wantRelief:        'Want flat-panel relief instead?',
    switchToRelief:    'Switch to AI Relief →',

    // ── 3D generating step ────────────────────────────────────────────────
    generatingTitle:   '✦ Generating your 3D model',
    modelReady:        '✓ Your 3D model is ready!',
    generationFailed:  '⚠ Generation failed',
    generatingPct:     (p: number) => `Generating 3D model… ${p}%`,
    finalising:        'Finalising model',
    queuedTripo:       'Queued in Tripo',
    convertingMesh:    'Converting mesh to STL',
    takingLonger:      'Taking longer than expected…',
    playFlappy:        'Play Flappy Bird while you wait',
    playFlappyHint:    "We'll show you when the model is ready",
    viewModel:         'View 3D Model →',
    tryAgain:          'Try again',
    cancelStartOver:   'Cancel and start over',
    startOver:         'Start over',
    stuckHint:         'The server is taking longer than usual to finalise. You can wait a bit more, or cancel and try again — generation should be faster next time.',

    // ── 3D result step ────────────────────────────────────────────────────
    meshPreview:       'Mesh Preview',
    full3dMesh:        'Full 3D mesh',
    full3dMeshInfo:    'Best for rotary CNC, 4th-axis, or 3D printing. For flat bas-relief on 3-axis, start over and use AI Relief.',
    downloadStl:       'Download STL',
    downloadStlSub:    'CNC · print ↓',
    downloadStlNote:   'STL works with all CNC CAM software and 3D printer slicers.',
    downloadGlb:       'Download GLB',
    loadingModel:      'Loading 3D model…',
    couldntLoad:       "Couldn't load the 3D model",
    expiredHint:       'The model file may have expired. Generate a new one, or download the STL directly.',
    generateNew:       '↺ Generate new model',

    // ── Auth modal ────────────────────────────────────────────────────────
    signInTitle:       'Sign in to WeCarver',
    signInSubtitle:    'Sign in to save your models and access them anywhere.',
    signUpTitle:       'Create your account',
    signUpSubtitle:    'Save your AI reliefs and 3D models permanently.',
    emailAddress:      'Email address',
    password:          'Password',
    signInBtn:         'Sign in',
    createAccountBtn:  'Create account',
    noAccount:         "Don't have an account?",
    signUpFree:        'Sign up free',
    alreadyHaveOne:    'Already have one?',
    checkEmail:        '✓ Check your email to confirm your account, then sign in.',
    goToSignIn:        'Go to sign in',

    // ── Recent panel ──────────────────────────────────────────────────────
    recentCreations:   'Recent Creations',
    savedSession:      (n: number) => `${n} of 5 saved this session`,
    noCreations:       'No creations yet',
    noCreationsHint:   'Generate something to see it here.',
    badgeRelief:       '▦ Relief',
    badgeModel3d:      '◈ 3D Model',
    relief:            'Relief',
    model3d:           '3D Model',
    latest:            'LATEST',
    loadCreation:      'Load this creation →',

    // ── Background job indicator ──────────────────────────────────────────
    generatingRelief:  'Generating 3D relief…',
    playWhileWait:     'Play while you wait',

    // ── Footer ────────────────────────────────────────────────────────────
    footerRelief:      'Relief: gpt-image-1 via OpenAI',
    footer3d:          '3D Model: Tripo3D v2.5',
    footerUpload:      'Upload: your image → AI enhance → relief',
  },

  zh: {
    // ── App / header ───────────────────────────────────────────────────────
    appTagline:        'AI 浮雕',
    signIn:            '登录',
    signOut:           '退出',
    recent:            '历史',
    langLabel:         'English',

    // ── Flow cards ────────────────────────────────────────────────────────
    aiRelief:          'AI 浮雕',
    aiReliefDesc:      '描述任意图案——AI 生成图像并雕刻成立体浮雕面板',
    uploadImage:       '上传图片',
    uploadImageDesc:   '使用你的照片或图稿——AI 增强后转为雕刻浮雕',
    full3dModel:       '完整 3D 模型',
    full3dModelDesc:   '描述任意物体——AI 构建完整 3D 网格，适用于旋转 CNC 或 3D 打印',

    // ── Step labels ───────────────────────────────────────────────────────
    stepDescribe:      '描述',
    stepGenerate:      '生成',
    stepConvert:       '转换',
    stepPreview:       '预览',
    stepChoose:        '选择',
    stepRelief:        '浮雕',

    // ── AI Relief prompt step ─────────────────────────────────────────────
    describeDesign:    '描述你的设计',
    describeHint:      '输入任意想法——我们将生成两张图片，将你喜欢的制作成可雕刻的 3D 浮雕 STL 文件，可直接用于你的 CNC 机器。',
    generateImages:    '✦ 生成图片',
    tryExample:        '试试这些示例：',
    alreadyHaveImage:  '已有图片？',
    uploadYourOwn:     '上传你的图片 →',

    // ── Upload step ───────────────────────────────────────────────────────
    uploadTitle:       '上传你的图片',
    uploadSubtitle:    '上传任意图稿、照片或图标——我们将进行 AI 增强并转换为适合你 CNC 机器的 3D 浮雕 STL 文件。',
    uploadDropHint:    '拖拽、粘贴或点击上传',
    uploadFormats:     '支持 JPEG、PNG、WEBP、GIF、BMP、TIFF · 最大 30 MB',
    uploadHint:        'JPG、PNG 或 WebP · 最大 30 MB',
    uploadDrop:        '拖拽图片到此处或点击浏览',
    uploadAnalysing:   '正在分析图片…',
    uploadUsually:     '通常只需几秒',
    uploadErrType:     '请上传图片文件（JPEG、PNG、WEBP 等）',
    uploadErrSize:     '文件过大——最大 30 MB',
    uploadFailed:      '上传失败',
    preferAi:          '想让 AI 帮你生成图片？',
    generateHere:      '在这里生成',

    // ── Select step ───────────────────────────────────────────────────────
    chooseImage:       '选择你喜欢的',
    yourPrompt:        '你的提示词：',
    promptEnhanced:    '提示词已增强以获得更好效果',
    hideEnhanced:      '隐藏增强提示词',
    generatingVars:    '正在生成新变体…',
    usuallyTime:       '通常 15–25 秒',
    selectedCheck:     '✓ 已选择',
    selectThis:        '选择这张 →',
    variation:         (n: number) => `变体 ${n}`,
    regenerateBoth:    '↺  重新生成两张',
    regenerate:        '↺ 重新生成',
    generatingDots:    '生成中…',
    enhanced:          '增强提示词：',

    // ── Enhance step ──────────────────────────────────────────────────────
    enhanceTitle:      '增强以备雕刻',
    enhanceSubtitle:   'AI 将你的图片转换为雕塑深度图——提升细节与对比度，让每一刀都更加清晰。',
    detected:          '识别结果：',
    labelOriginal:     '原图',
    labelEnhanced:     '✦ 增强',
    convertingStyle:   '正在转换为雕塑风格…',
    useOriginal:       '使用原图',
    useEnhanced:       '使用增强版 →',
    skipEnhancement:   '跳过增强',
    enhanceBtn:        '✦  增强以备雕刻',
    enhancing:         '增强中…',
    featureSharpen:    '锐化细节',
    featureClarity:    '提升清晰度',
    featureDefinition: '加强轮廓',

    // ── Preview step ──────────────────────────────────────────────────────
    previewTitle:      '预览你的浮雕',
    previewLead:       '预览一下，可按需调整…',
    createRelief:      '创建 3D 浮雕',
    createModel:       '✦  创建模型',
    removeBg:          '去除背景',
    back:              '← 返回',
    previewNote:       '生成高度图并转换为可打印的 STL 浮雕',

    // ── Relief step ───────────────────────────────────────────────────────
    reliefReady:       '3D 浮雕已完成',
    downloadRelief:    '下载 STL',
    downloadHeightmap: '下载高度图',
    downloadImage:     '下载图片',
    depth:             '深度',
    detail:            '细节',
    smooth:            '平滑',
    sliderScaleZ:      'Z 轴缩放',
    sliderDetail:      '细节增强',
    sliderReplace:     '背景替换',
    sliderDraft:       'V 型刀具倾角',
    draftHint:         '设为你刀具的半角（60° 刀具 → 30°）',
    draftOff:          '关闭',
    editHeightCurve:   '编辑高度曲线',
    scaleHeightsY:     '沿 Y 轴缩放高度',
    scaleHeightsX:     '沿 X 轴缩放高度',
    heightmapLabel:    '高度图',
    updatingStl:       '更新 STL 中…',
    startOverBtn:      '↺ 重新开始',
    dragOrbit:         '拖拽旋转 · 滚轮缩放',

    // ── 3D model prompt step ──────────────────────────────────────────────
    generate3dTitle:   '生成 3D 物体',
    generate3dHint:    '描述任意物体——AI 构建完整 3D 网格，可在旋转 CNC、4 轴装置上雕刻，或直接发送到 3D 打印机。',
    generate3dBtn:     '✦ 生成 3D 模型',
    full3dMeshNote:    '完整 3D 网格',
    full3dMeshDesc:    '输出 STL 格式（CNC/打印）。最适合旋转轴或 4 轴 CNC。平面浮雕雕刻请使用 AI 浮雕流程。',
    wantRelief:        '想要平面浮雕？',
    switchToRelief:    '切换到 AI 浮雕 →',

    // ── 3D generating step ────────────────────────────────────────────────
    generatingTitle:   '✦ 正在生成你的 3D 模型',
    modelReady:        '✓ 你的 3D 模型已准备好！',
    generationFailed:  '⚠ 生成失败',
    generatingPct:     (p: number) => `正在生成 3D 模型… ${p}%`,
    finalising:        '正在最终处理',
    queuedTripo:       '在 Tripo 队列中',
    convertingMesh:    '正在转换网格为 STL',
    takingLonger:      '耗时比预期长…',
    playFlappy:        '等待时玩 Flappy Bird',
    playFlappyHint:    '模型准备好后我们会通知你',
    viewModel:         '查看 3D 模型 →',
    tryAgain:          '重试',
    cancelStartOver:   '取消并重新开始',
    startOver:         '重新开始',
    stuckHint:         '服务器处理时间比平时长，你可以继续等待，或取消后重试——下次生成应该会更快。',

    // ── 3D result step ────────────────────────────────────────────────────
    meshPreview:       '网格预览',
    full3dMesh:        '完整 3D 网格',
    full3dMeshInfo:    '最适合旋转 CNC、4 轴或 3D 打印。3 轴平面浮雕请重新开始并使用 AI 浮雕。',
    downloadStl:       '下载 STL',
    downloadStlSub:    'CNC · 打印 ↓',
    downloadStlNote:   'STL 格式兼容所有 CNC CAM 软件和 3D 打印机切片软件。',
    downloadGlb:       '下载 GLB',
    loadingModel:      '加载 3D 模型中…',
    couldntLoad:       '无法加载 3D 模型',
    expiredHint:       '模型文件可能已过期，请重新生成，或直接下载 STL 文件。',
    generateNew:       '↺ 重新生成模型',

    // ── Auth modal ────────────────────────────────────────────────────────
    signInTitle:       '登录 WeCarver',
    signInSubtitle:    '登录后可保存模型并随时随地访问。',
    signUpTitle:       '创建你的账户',
    signUpSubtitle:    '永久保存你的 AI 浮雕和 3D 模型。',
    emailAddress:      '邮箱地址',
    password:          '密码',
    signInBtn:         '登录',
    createAccountBtn:  '创建账户',
    noAccount:         '还没有账户？',
    signUpFree:        '免费注册',
    alreadyHaveOne:    '已有账户？',
    checkEmail:        '✓ 请检查邮箱确认账户，然后登录。',
    goToSignIn:        '前往登录',

    // ── Recent panel ──────────────────────────────────────────────────────
    recentCreations:   '历史创作',
    savedSession:      (n: number) => `本次会话已保存 ${n}/5 个`,
    noCreations:       '暂无创作记录',
    noCreationsHint:   '生成一些作品后会显示在这里。',
    badgeRelief:       '▦ 浮雕',
    badgeModel3d:      '◈ 3D 模型',
    relief:            '浮雕',
    model3d:           '3D 模型',
    latest:            '最新',
    loadCreation:      '加载此创作 →',

    // ── Background job indicator ──────────────────────────────────────────
    generatingRelief:  '正在生成 3D 浮雕…',
    playWhileWait:     '等待时游玩',

    // ── Footer ────────────────────────────────────────────────────────────
    footerRelief:      '浮雕：OpenAI gpt-image-1',
    footer3d:          '3D 模型：Tripo3D v2.5',
    footerUpload:      '上传：你的图片 → AI 增强 → 浮雕',
  },
} as const

// Derive a general shape where every value is string or (n:number)=>string
export type T = {
  [K in keyof typeof TRANSLATIONS.en]:
    typeof TRANSLATIONS.en[K] extends (n: number) => string
      ? (n: number) => string
      : string
}
