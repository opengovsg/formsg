/* eslint-disable */

// BEFORE
// Count total number of these fields
{
  const ATTR_NAME = 'schoolname'
  const beforePipeline = [
    { $match: { form_fields: { $exists: true, $not: { $size: 0 } }, 'form_fields.myInfo.attr': ATTR_NAME } },
    { $project: { form_fields: 1 } },
    { $unwind: '$form_fields' },
    { $match: { 'form_fields.myInfo.attr': ATTR_NAME } },
    { $count: 'numFields' }
  ]
  db.forms.aggregate(beforePipeline)
}

// Count number of forms with this field
{
  const ATTR_NAME = 'schoolname'
  const pipeline = [
    { $match: { form_fields: { $exists: true, $not: { $size: 0 } }, 'form_fields.myInfo.attr': ATTR_NAME } },
    { $count: 'numForms' }
  ]
  db.forms.aggregate(pipeline)
}

// UPDATE
// Should be same as number of forms
{
  const ATTR_NAME = 'schoolname'
  const FIELD_OPTIONS = [
    'ADMIRALTY PRIMARY SCHOOL',
    'ADMIRALTY SECONDARY SCHOOL',
    'AHMAD IBRAHIM PRIMARY SCHOOL',
    'AHMAD IBRAHIM SECONDARY SCHOOL',
    'AI TONG SCHOOL',
    'ALEXANDRA PRIMARY SCHOOL',
    'ANCHOR GREEN PRIMARY SCHOOL',
    'ANDERSON JUNIOR COLLEGE',
    'ANDERSON PRIMARY SCHOOL',
    'ANDERSON SECONDARY SCHOOL',
    'ANG MO KIO PRIMARY SCHOOL',
    'ANG MO KIO SECONDARY SCHOOL',
    'ANGLICAN HIGH SCHOOL',
    'ANGLO-CHINESE JUNIOR COLLEGE',
    'ANGLO-CHINESE SCHOOL (BARKER ROAD)',
    'ANGLO-CHINESE SCHOOL (INDEPENDENT)',
    'ANGLO-CHINESE SCHOOL (JUNIOR)',
    'ANGLO-CHINESE SCHOOL (PRIMARY)',
    'ASSUMPTION ENGLISH SCHOOL',
    'ASSUMPTION PATHWAY SCHOOL',
    'BALESTIER HILL PRIMARY SCHOOL',
    'BALESTIER HILL SECONDARY SCHOOL',
    'BARTLEY SECONDARY SCHOOL',
    'BEACON PRIMARY SCHOOL',
    'BEATTY SECONDARY SCHOOL',
    'BEDOK GREEN PRIMARY SCHOOL',
    'BEDOK GREEN SECONDARY SCHOOL',
    'BEDOK NORTH SECONDARY SCHOOL',
    'BEDOK SOUTH SECONDARY SCHOOL',
    'BEDOK TOWN SECONDARY SCHOOL',
    'BEDOK VIEW SECONDARY SCHOOL',
    'BENDEMEER PRIMARY SCHOOL',
    'BENDEMEER SECONDARY SCHOOL',
    'BISHAN PARK SECONDARY SCHOOL',
    'BLANGAH RISE PRIMARY SCHOOL',
    'BOON LAY GARDEN PRIMARY SCHOOL',
    'BOON LAY SECONDARY SCHOOL',
    'BOWEN SECONDARY SCHOOL',
    'BROADRICK SECONDARY SCHOOL',
    'BUKIT BATOK SECONDARY SCHOOL',
    'BUKIT MERAH SECONDARY SCHOOL',
    'BUKIT PANJANG GOVT. HIGH SCHOOL',
    'BUKIT PANJANG PRIMARY SCHOOL',
    'BUKIT TIMAH PRIMARY SCHOOL',
    'BUKIT VIEW PRIMARY SCHOOL',
    'BUKIT VIEW SECONDARY SCHOOL',
    'CANBERRA PRIMARY SCHOOL',
    'CANBERRA SECONDARY SCHOOL',
    'CANOSSA CONVENT PRIMARY SCHOOL',
    'CANTONMENT PRIMARY SCHOOL',
    'CASUARINA PRIMARY SCHOOL',
    'CATHOLIC HIGH SCHOOL',
    'CATHOLIC JUNIOR COLLEGE',
    "CEDAR GIRLS' SECONDARY SCHOOL",
    'CEDAR PRIMARY SCHOOL',
    'CG PROTEGE ANIMATION SCHOOL',
    'CHANGKAT CHANGI SECONDARY SCHOOL',
    'CHANGKAT PRIMARY SCHOOL',
    'CHESTNUT DRIVE SECONDARY SCHOOL',
    'CHIJ (KATONG) PRIMARY',
    'CHIJ (KELLOCK)',
    'CHIJ KATONG CONVENT',
    'CHIJ OUR LADY OF GOOD COUNSEL',
    'CHIJ OUR LADY OF THE NATIVITY',
    'CHIJ OUR LADY QUEEN OF PEACE',
    'CHIJ PRIMARY (TOA PAYOH)',
    'CHIJ SECONDARY (TOA PAYOH)',
    "CHIJ ST. JOSEPH'S CONVENT",
    "CHIJ ST. NICHOLAS GIRLS' SCHOOL",
    "CHIJ ST. THERESA'S CONVENT",
    'CHONG BOON SECONDARY SCHOOL',
    'CHONGFU PRIMARY SCHOOL',
    'CHONGZHENG PRIMARY SCHOOL',
    'CHRIST CHURCH SECONDARY SCHOOL',
    'CHUA CHU KANG PRIMARY SCHOOL',
    'CHUA CHU KANG SECONDARY SCHOOL',
    'CHUNG CHENG HIGH SCHOOL (MAIN)',
    'CHUNG CHENG HIGH SCHOOL (YISHUN)',
    'CLEMENTI PRIMARY SCHOOL',
    'CLEMENTI TOWN SECONDARY SCHOOL',
    'CLEMENTI WOODS SECONDARY SCHOOL',
    'COMMONWEALTH SECONDARY SCHOOL',
    'COMPASSVALE PRIMARY SCHOOL',
    'COMPASSVALE SECONDARY SCHOOL',
    'CONCORD PRIMARY SCHOOL',
    'CORAL PRIMARY SCHOOL',
    'CORAL SECONDARY SCHOOL',
    'CORPORATION PRIMARY SCHOOL',
    "CRESCENT GIRLS' SCHOOL",
    'CREST SECONDARY SCHOOL',
    'DA QIAO PRIMARY SCHOOL',
    'DAMAI PRIMARY SCHOOL',
    'DAMAI SECONDARY SCHOOL',
    'DAZHONG PRIMARY SCHOOL',
    'DE LA SALLE SCHOOL',
    'DEYI SECONDARY SCHOOL',
    'DUNEARN SECONDARY SCHOOL',
    'DUNMAN HIGH SCHOOL',
    'DUNMAN SECONDARY SCHOOL',
    'EAST COAST PRIMARY SCHOOL',
    'EAST SPRING PRIMARY SCHOOL',
    'EAST SPRING SECONDARY SCHOOL',
    'EAST VIEW PRIMARY SCHOOL',
    'EAST VIEW SECONDARY SCHOOL',
    'EDGEFIELD PRIMARY SCHOOL',
    'EDGEFIELD SECONDARY SCHOOL',
    'ELIAS PARK PRIMARY SCHOOL',
    'ENDEAVOUR PRIMARY SCHOOL',
    'EUNOS PRIMARY SCHOOL',
    'EVERGREEN PRIMARY SCHOOL',
    'EVERGREEN SECONDARY SCHOOL',
    'FAIRFIELD METHODIST SCHOOL (PRIMARY)',
    'FAIRFIELD METHODIST SCHOOL (SECONDARY)',
    'FAJAR SECONDARY SCHOOL',
    'FARRER PARK PRIMARY SCHOOL',
    'FENGSHAN PRIMARY SCHOOL',
    'FERNVALE PRIMARY SCHOOL',
    'FIRST TOA PAYOH PRIMARY SCHOOL',
    'FIRST TOA PAYOH SECONDARY SCHOOL',
    'FRONTIER PRIMARY SCHOOL',
    'FUCHUN PRIMARY SCHOOL',
    'FUCHUN SECONDARY SCHOOL',
    'FUHUA PRIMARY SCHOOL',
    'FUHUA SECONDARY SCHOOL',
    'GAN ENG SENG PRIMARY SCHOOL',
    'GAN ENG SENG SCHOOL',
    'GEYLANG METHODIST SCHOOL (PRIMARY)',
    'GEYLANG METHODIST SCHOOL (SECONDARY)',
    'GONGSHANG PRIMARY SCHOOL',
    'GREENDALE PRIMARY SCHOOL',
    'GREENDALE SECONDARY SCHOOL',
    'GREENRIDGE PRIMARY SCHOOL',
    'GREENRIDGE SECONDARY SCHOOL',
    'GREENVIEW SECONDARY SCHOOL',
    'GREENWOOD PRIMARY SCHOOL',
    'GUANGYANG PRIMARY SCHOOL',
    'GUANGYANG SECONDARY SCHOOL',
    'HAI SING CATHOLIC SCHOOL',
    "HAIG GIRLS' SCHOOL",
    'HENDERSON SECONDARY SCHOOL',
    'HENRY PARK PRIMARY SCHOOL',
    'HILLGROVE SECONDARY SCHOOL',
    "HOLY INNOCENTS' HIGH SCHOOL",
    "HOLY INNOCENTS' PRIMARY SCHOOL",
    'HONG KAH SECONDARY SCHOOL',
    'HONG WEN SCHOOL',
    'HORIZON PRIMARY SCHOOL',
    'HOUGANG PRIMARY SCHOOL',
    'HOUGANG SECONDARY SCHOOL',
    'HUA YI SECONDARY SCHOOL',
    'HUAMIN PRIMARY SCHOOL',
    'HWA CHONG INSTITUTION',
    'INNOVA JUNIOR COLLEGE',
    'INNOVA PRIMARY SCHOOL',
    'JIEMIN PRIMARY SCHOOL',
    'JING SHAN PRIMARY SCHOOL',
    'JUNYUAN PRIMARY SCHOOL',
    'JUNYUAN SECONDARY SCHOOL',
    'JURONG JUNIOR COLLEGE',
    'JURONG PRIMARY SCHOOL',
    'JURONG SECONDARY SCHOOL',
    'JURONG WEST PRIMARY SCHOOL',
    'JURONG WEST SECONDARY SCHOOL',
    'JURONGVILLE SECONDARY SCHOOL',
    'JUYING PRIMARY SCHOOL',
    'JUYING SECONDARY SCHOOL',
    'KEMING PRIMARY SCHOOL',
    'KENT RIDGE SECONDARY SCHOOL',
    'KHENG CHENG SCHOOL',
    'KONG HWA SCHOOL',
    'KRANJI PRIMARY SCHOOL',
    'KRANJI SECONDARY SCHOOL',
    'KUO CHUAN PRESBYTERIAN PRIMARY SCHOOL',
    'KUO CHUAN PRESBYTERIAN SECONDARY SCHOOL',
    'LAKESIDE PRIMARY SCHOOL',
    'LASALLE COLLEGE OF THE ARTS',
    'LIANHUA PRIMARY SCHOOL',
    'LOYANG PRIMARY SCHOOL',
    'LOYANG SECONDARY SCHOOL',
    'MACPHERSON PRIMARY SCHOOL',
    'MACPHERSON SECONDARY SCHOOL',
    'MAHA BODHI SCHOOL',
    'MANJUSRI SECONDARY SCHOOL',
    'MARIS STELLA HIGH SCHOOL',
    'MARSILING PRIMARY SCHOOL',
    'MARSILING SECONDARY SCHOOL',
    'MARYMOUNT CONVENT SCHOOL',
    'MAYFLOWER PRIMARY SCHOOL',
    'MAYFLOWER SECONDARY SCHOOL',
    'MEE TOH SCHOOL',
    'MERIDIAN JUNIOR COLLEGE',
    'MERIDIAN PRIMARY SCHOOL',
    "METHODIST GIRLS' SCHOOL (PRIMARY)",
    "METHODIST GIRLS' SCHOOL (SECONDARY)",
    'MILLENNIA INSTITUTE',
    'MONTFORT JUNIOR SCHOOL',
    'MONTFORT SECONDARY SCHOOL',
    'NAN CHIAU HIGH SCHOOL',
    'NAN CHIAU PRIMARY SCHOOL',
    'NAN HUA HIGH SCHOOL',
    'NAN HUA PRIMARY SCHOOL',
    'NANYANG ACADEMY OF FINE ARTS',
    "NANYANG GIRLS' HIGH SCHOOL",
    'NANYANG JUNIOR COLLEGE',
    'NANYANG POLYTECHNIC',
    'NANYANG PRIMARY SCHOOL',
    'NANYANG TECHNOLOGICAL UNIVERSITY',
    'NATIONAL JUNIOR COLLEGE',
    'NATIONAL UNIVERSITY OF SINGAPORE',
    'NAVAL BASE PRIMARY SCHOOL',
    'NAVAL BASE SECONDARY SCHOOL',
    'NEW TOWN PRIMARY SCHOOL',
    'NEW TOWN SECONDARY SCHOOL',
    'NGEE ANN POLYTECHNIC',
    'NGEE ANN PRIMARY SCHOOL',
    'NGEE ANN SECONDARY SCHOOL',
    'NORTH SPRING PRIMARY SCHOOL',
    'NORTH VIEW PRIMARY SCHOOL',
    'NORTH VIEW SECONDARY SCHOOL',
    'NORTH VISTA PRIMARY SCHOOL',
    'NORTH VISTA SECONDARY SCHOOL',
    'NORTHBROOKS SECONDARY SCHOOL',
    'NORTHLAND PRIMARY SCHOOL',
    'NORTHLAND SECONDARY SCHOOL',
    'NORTHLIGHT SCHOOL',
    'NORTHOAKS PRIMARY SCHOOL',
    'NUS HIGH SCHOOL OF MATHEMATICS AND SCIENCE',
    'OPERA ESTATE PRIMARY SCHOOL',
    'ORCHID PARK SECONDARY SCHOOL',
    'OUTRAM SECONDARY SCHOOL',
    'PALM VIEW PRIMARY SCHOOL',
    'PARK VIEW PRIMARY SCHOOL',
    'PASIR RIS CREST SECONDARY SCHOOL',
    'PASIR RIS PRIMARY SCHOOL',
    'PASIR RIS SECONDARY SCHOOL',
    "PAYA LEBAR METHODIST GIRLS' SCHOOL (PRIMARY)",
    "PAYA LEBAR METHODIST GIRLS' SCHOOL (SECONDARY)",
    'PEI CHUN PUBLIC SCHOOL',
    'PEI HWA PRESBYTERIAN PRIMARY SCHOOL',
    'PEI HWA SECONDARY SCHOOL',
    'PEI TONG PRIMARY SCHOOL',
    'PEICAI SECONDARY SCHOOL',
    'PEIRCE SECONDARY SCHOOL',
    'PEIYING PRIMARY SCHOOL',
    'PING YI SECONDARY SCHOOL',
    'PIONEER JUNIOR COLLEGE',
    'PIONEER PRIMARY SCHOOL',
    'PIONEER SECONDARY SCHOOL',
    'POI CHING SCHOOL',
    'PRESBYTERIAN HIGH SCHOOL',
    'PRINCESS ELIZABETH PRIMARY SCHOOL',
    'PUNGGOL GREEN PRIMARY SCHOOL',
    'PUNGGOL PRIMARY SCHOOL',
    'PUNGGOL SECONDARY SCHOOL',
    'PUNGGOL VIEW PRIMARY SCHOOL',
    'QIFA PRIMARY SCHOOL',
    'QIHUA PRIMARY SCHOOL',
    'QUEENSTOWN PRIMARY SCHOOL',
    'QUEENSTOWN SECONDARY SCHOOL',
    'QUEENSWAY SECONDARY SCHOOL',
    'RADIN MAS PRIMARY SCHOOL',
    "RAFFLES GIRLS' PRIMARY SCHOOL",
    "RAFFLES GIRLS' SCHOOL (SECONDARY)",
    'RAFFLES INSTITUTION',
    'RED SWASTIKA SCHOOL',
    'REGENT SECONDARY SCHOOL',
    'REPUBLIC POLYTECHNIC',
    'RIVER VALLEY HIGH SCHOOL',
    'RIVER VALLEY PRIMARY SCHOOL',
    'RIVERSIDE PRIMARY SCHOOL',
    'RIVERSIDE SECONDARY SCHOOL',
    'RIVERVALE PRIMARY SCHOOL',
    'ROSYTH SCHOOL',
    'RULANG PRIMARY SCHOOL',
    'SCHOOL OF SCIENCE AND TECHNOLOGY, SINGAPORE',
    'SCHOOL OF THE ARTS, SINGAPORE',
    'SEMBAWANG PRIMARY SCHOOL',
    'SEMBAWANG SECONDARY SCHOOL',
    'SENG KANG PRIMARY SCHOOL',
    'SENG KANG SECONDARY SCHOOL',
    'SENGKANG GREEN PRIMARY SCHOOL',
    'SERANGOON GARDEN SECONDARY SCHOOL',
    'SERANGOON JUNIOR COLLEGE',
    'SERANGOON SECONDARY SCHOOL',
    'SHUQUN PRIMARY SCHOOL',
    'SHUQUN SECONDARY SCHOOL',
    'SI LING PRIMARY SCHOOL',
    'SI LING SECONDARY SCHOOL',
    'SIGLAP SECONDARY SCHOOL',
    'SIM UNIVERSITY',
    "SINGAPORE CHINESE GIRLS' PRIMARY SCHOOL",
    "SINGAPORE CHINESE GIRLS' SCHOOL",
    'SINGAPORE INSTITUTE OF TECHNOLOGY',
    'SINGAPORE MANAGEMENT UNIVERSITY',
    'SINGAPORE POLYTECHNIC',
    'SINGAPORE RAFFLES MUSIC COLLEGE',
    'SINGAPORE SPORTS SCHOOL',
    'SINGAPORE UNIVERSITY OF TECHNOLOGY AND DESIGN',
    'SOUTH VIEW PRIMARY SCHOOL',
    'SPECTRA SECONDARY SCHOOL',
    'SPRINGDALE PRIMARY SCHOOL',
    'SPRINGFIELD SECONDARY SCHOOL',
    "ST. ANDREW'S JUNIOR COLLEGE",
    "ST. ANDREW'S JUNIOR SCHOOL",
    "ST. ANDREW'S SECONDARY SCHOOL",
    "ST. ANTHONY'S CANOSSIAN PRIMARY SCHOOL",
    "ST. ANTHONY'S CANOSSIAN SECONDARY SCHOOL",
    "ST. ANTHONY'S PRIMARY SCHOOL",
    "ST. GABRIEL'S PRIMARY SCHOOL",
    "ST. GABRIEL'S SECONDARY SCHOOL",
    "ST. HILDA'S PRIMARY SCHOOL",
    "ST. HILDA'S SECONDARY SCHOOL",
    "ST. JOSEPH'S INSTITUTION",
    "ST. JOSEPH'S INSTITUTION JUNIOR",
    "ST. MARGARET'S PRIMARY SCHOOL",
    "ST. MARGARET'S SECONDARY SCHOOL",
    "ST. PATRICK'S SCHOOL",
    "ST. STEPHEN'S SCHOOL",
    'STAMFORD PRIMARY SCHOOL',
    'SWISS COTTAGE SECONDARY SCHOOL',
    'TAMPINES JUNIOR COLLEGE',
    'TAMPINES NORTH PRIMARY SCHOOL',
    'TAMPINES PRIMARY SCHOOL',
    'TAMPINES SECONDARY SCHOOL',
    'TANGLIN SECONDARY SCHOOL',
    "TANJONG KATONG GIRLS' SCHOOL",
    'TANJONG KATONG PRIMARY SCHOOL',
    'TANJONG KATONG SECONDARY SCHOOL',
    'TAO NAN SCHOOL',
    'TECK GHEE PRIMARY SCHOOL',
    'TECK WHYE PRIMARY SCHOOL',
    'TECK WHYE SECONDARY SCHOOL',
    'TELOK KURAU PRIMARY SCHOOL',
    'TEMASEK JUNIOR COLLEGE',
    'TEMASEK POLYTECHNIC',
    'TEMASEK PRIMARY SCHOOL',
    'TEMASEK SECONDARY SCHOOL',
    'TOWNSVILLE PRIMARY SCHOOL',
    'UNITY PRIMARY SCHOOL',
    'UNITY SECONDARY SCHOOL',
    'VICTORIA JUNIOR COLLEGE',
    'VICTORIA SCHOOL',
    'WELLINGTON PRIMARY SCHOOL',
    'WEST GROVE PRIMARY SCHOOL',
    'WEST SPRING PRIMARY SCHOOL',
    'WEST SPRING SECONDARY SCHOOL',
    'WEST VIEW PRIMARY SCHOOL',
    'WESTWOOD PRIMARY SCHOOL',
    'WESTWOOD SECONDARY SCHOOL',
    'WHITE SANDS PRIMARY SCHOOL',
    'WHITLEY SECONDARY SCHOOL',
    'WOODGROVE PRIMARY SCHOOL',
    'WOODGROVE SECONDARY SCHOOL',
    'WOODLANDS PRIMARY SCHOOL',
    'WOODLANDS RING PRIMARY SCHOOL',
    'WOODLANDS RING SECONDARY SCHOOL',
    'WOODLANDS SECONDARY SCHOOL',
    'XINGHUA PRIMARY SCHOOL',
    'XINGNAN PRIMARY SCHOOL',
    'XINMIN PRIMARY SCHOOL',
    'XINMIN SECONDARY SCHOOL',
    'XISHAN PRIMARY SCHOOL',
    'YALE-NUS COLLEGE',
    'YANGZHENG PRIMARY SCHOOL',
    'YEW TEE PRIMARY SCHOOL',
    'YIO CHU KANG PRIMARY SCHOOL',
    'YIO CHU KANG SECONDARY SCHOOL',
    'YISHUN JUNIOR COLLEGE',
    'YISHUN PRIMARY SCHOOL',
    'YISHUN SECONDARY SCHOOL',
    'YISHUN TOWN SECONDARY SCHOOL',
    'YU NENG PRIMARY SCHOOL',
    'YUAN CHING SECONDARY SCHOOL',
    'YUHUA PRIMARY SCHOOL',
    'YUHUA SECONDARY SCHOOL',
    'YUMIN PRIMARY SCHOOL',
    'YUSOF ISHAK SECONDARY SCHOOL',
    'YUYING SECONDARY SCHOOL',
    'ZHANGDE PRIMARY SCHOOL',
    'ZHENGHUA PRIMARY SCHOOL',
    'ZHENGHUA SECONDARY SCHOOL',
    'ZHONGHUA PRIMARY SCHOOL',
    'ZHONGHUA SECONDARY SCHOOL',
  ]
  db.forms.updateMany(
    { form_fields: { $exists: true, $not: { $size: 0 } }, 'form_fields.myInfo.attr': ATTR_NAME },
    { $unset: { 'form_fields.$[field].myInfo': 1 }, $set: { 'form_fields.$[field].fieldOptions': FIELD_OPTIONS } },
    { arrayFilters: [{ 'field.myInfo.attr': ATTR_NAME }] }
  )
}

// AFTER
// Ideally 0, unless someone has inserted a new field in between
{
  const ATTR_NAME = 'schoolname'
  const afterPipeline = [
    { $match: { form_fields: { $exists: true, $not: { $size: 0 } }, 'form_fields.myInfo.attr': ATTR_NAME } },
    { $project: { form_fields: 1 } },
    { $unwind: '$form_fields' },
    { $match: { 'form_fields.myInfo.attr': ATTR_NAME } },
    { $count: 'numFields' }
  ]
  db.forms.aggregate(afterPipeline)
}

// Count number of forms with this field
{
  const ATTR_NAME = 'schoolname'
  const pipeline = [
    { $match: { form_fields: { $exists: true, $not: { $size: 0 } }, 'form_fields.myInfo.attr': ATTR_NAME } },
    { $count: 'numForms' }
  ]
  db.forms.aggregate(pipeline)
}
