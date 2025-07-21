// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 81,
    "userId": 57,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "idToken": "idToken_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 20,
    "userId": 89,
    "expires": "2025-07-21T03:02:37.893Z",
    "sessionToken": "sessionToken_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 70,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-21T03:02:37.893Z",
    "image": "image_1"
  },
  {
    "id": 87,
    "emailVerified": "2025-07-21T03:02:37.893Z",
    "image": "image_2"
  },
  {
    "id": 68,
    "email": "instructor@example.com",
    "emailVerified": "2025-07-21T03:02:37.893Z",
    "image": "image_3"
  },
  {
    "id": 38,
    "name": "TA User",
    "email": "ta@example.com",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "d098814k-9tpg-ezl7-4vun-85m7h69zzpv",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "lastLogin": "2025-07-21T03:02:37.893Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-21T03:02:37.893Z",
    "userId": 70
  },
  {
    "id": "v12nxjw3-nmsf-bak9-npm7-1oia1afsz9l",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "userId": 87,
    "lastLogin": "2025-07-21T03:02:37.893Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-21T03:02:37.893Z"
  },
  {
    "id": "m7xl9vkx-2o0v-f8je-jlkp-gvu0etxwrz4",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "userId": 68,
    "lastLogin": "2025-07-21T03:02:37.893Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-21T03:02:37.893Z"
  },
  {
    "id": "hqpint4e-ogb0-4t3u-koli-85y0z5xk61",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "lastLogin": "2025-07-21T03:02:37.893Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-21T03:02:37.893Z",
    "userId": 38
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "r83kodbg-lbu5-gdcv-oki4-rt62gl8q529",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// DEPARTMENTS MOCK DATA
export const departments = [
  {
    "id": "0kpxh3gy-yfwz-y97i-ehvj-sla6082flth",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "departmentCode": "departmentCode_1",
    "name": "Departments 1",
    "description": "Description for departments 1",
    "profileIds": [
      "d098814k-9tpg-ezl7-4vun-85m7h69zzpv",
      "v12nxjw3-nmsf-bak9-npm7-1oia1afsz9l",
      "m7xl9vkx-2o0v-f8je-jlkp-gvu0etxwrz4",
      "hqpint4e-ogb0-4t3u-koli-85y0z5xk61"
    ]
  }
];

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "c9xr6sv5-x0yu-8qsj-31dw-6iey981507i",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "departmentId": "departmentId_1",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1",
    "profileIds": [
      "d098814k-9tpg-ezl7-4vun-85m7h69zzpv",
      "v12nxjw3-nmsf-bak9-npm7-1oia1afsz9l",
      "m7xl9vkx-2o0v-f8je-jlkp-gvu0etxwrz4",
      "hqpint4e-ogb0-4t3u-koli-85y0z5xk61"
    ]
  },
  {
    "id": "u8vk0yoa-d2yb-csd5-gy21-kvnsgsac7vq",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "departmentId": "departmentId_2",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2",
    "profileIds": [
      "d098814k-9tpg-ezl7-4vun-85m7h69zzpv",
      "v12nxjw3-nmsf-bak9-npm7-1oia1afsz9l",
      "m7xl9vkx-2o0v-f8je-jlkp-gvu0etxwrz4",
      "hqpint4e-ogb0-4t3u-koli-85y0z5xk61"
    ]
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "ljwhg7tk-0gfz-5wki-psaj-s9czz1292",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "5o67wwdy-7ekv-qh6u-nlvd-m68eaz6fzi7",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "2w1cqa9g-ngzj-4nvo-mu8q-rr3f261ueb",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 98,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "odylnjzh-i4be-bsny-n1j4-3wtb7shyu9",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 72,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "tv0w36r2-m5gv-66dl-61oz-u1zhxpldbf",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 56,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "wz54m9rr-iv0u-dvt5-jvx0-zw41bvyojq",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 46,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 39,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-21T03:02:37.893Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 72,
    "createdAt": "2025-07-21T03:02:37.893Z",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "ssdefvs5-yhlu-p12d-3zbm-kf5pndvrzw",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "6floflrq-c4is-5pz4-fkh3-t5mrkoppg58",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "l48f4tn5-qlbk-8q5h-hiqh-lscqoj8q0n",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "completedAt": "2025-07-21T03:02:37.893Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": false
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "cffhmz7i-jgz2-yx7v-dl4i-se44bezuiy",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": false,
    "defaultComponent": "defaultComponent_1"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "ibgs6mdp-qqiq-kwoa-4zi1-9aslrr38nqm",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "headerComponentIds": [
      "headerComponentIds_1"
    ],
    "primaryComponentIds": [
      "primaryComponentIds_1"
    ],
    "secondaryComponentIds": [
      "secondaryComponentIds_1"
    ],
    "footerComponentIds": [
      "footerComponentIds_1"
    ],
    "autoScroll": "autoScroll_1",
    "showIndicators": "showIndicators_1",
    "headerComponents": "headerComponents_1",
    "mainSplit": "mainSplit_1",
    "footerSplit": "footerSplit_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "cqehusgw-ft0n-vzb9-bcsv-y6tidhm86va",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.3,
    "defaultAgent": "defaultAgent_1",
    "color": "color_1",
    "modelId": "modelId_1"
  },
  {
    "id": "ukbvhcav-bj5j-6d0m-llwa-dkvxdvk8x8n",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.33,
    "defaultAgent": "defaultAgent_2",
    "color": "color_2",
    "reasoning": "medium"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "vnj674o7-5e42-xqmp-ss9g-sty2zd8vgop",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.96,
    "reasoning": "low"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "0m1j4t7m-01hd-2n0g-64he-8glkug6wxe",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "crowdedness": 72,
    "locationId": "locationId_1",
    "deadlineId": "deadlineId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": false,
    "parentId": "parentId_1"
  },
  {
    "id": "cu465xer-tak5-2jx1-iwcw-i9uxmmmznrf",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "intensity": 55,
    "locationId": "locationId_2",
    "deadlineId": "deadlineId_2",
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false
  }
];

// SCENARIOLOCATIONS MOCK DATA
export const scenarioLocations = [
  {
    "id": "h9zvky1h-swqk-f70a-ensh-ssr9tbs2vh",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "name": "Scenario_locations 1",
    "description": "Description for scenario_locations 1"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "lfq6pbpw-0ukj-x6qc-4ia7-xuh4iywoh1b",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "yi12jfko-2dwq-ijfy-gt96-ywyly1g81bm",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "mou5fils-3jju-9clt-fyxk-oqo6fwpmvk",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "d098814k-9tpg-ezl7-4vun-85m7h69zzpv",
      "v12nxjw3-nmsf-bak9-npm7-1oia1afsz9l",
      "m7xl9vkx-2o0v-f8je-jlkp-gvu0etxwrz4",
      "hqpint4e-ogb0-4t3u-koli-85y0z5xk61"
    ],
    "defaultCohort": "defaultCohort_1",
    "departmentId": "departmentId_1"
  },
  {
    "id": "jfvavn4o-gn0t-4s98-lt1x-tv5io17xvjb",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "d098814k-9tpg-ezl7-4vun-85m7h69zzpv",
      "v12nxjw3-nmsf-bak9-npm7-1oia1afsz9l",
      "m7xl9vkx-2o0v-f8je-jlkp-gvu0etxwrz4",
      "hqpint4e-ogb0-4t3u-koli-85y0z5xk61"
    ],
    "defaultCohort": "defaultCohort_2",
    "departmentId": "departmentId_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "88yisbmg-4h15-vfpp-5had-n0vqvcwr1en",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "0m1j4t7m-01hd-2n0g-64he-8glkug6wxe",
      "cu465xer-tak5-2jx1-iwcw-i9uxmmmznrf"
    ],
    "cohortIds": [
      "mou5fils-3jju-9clt-fyxk-oqo6fwpmvk",
      "jfvavn4o-gn0t-4s98-lt1x-tv5io17xvjb"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "dggbj5j6-ptsi-gyfa-iod8-0y0yxms5rra",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "0m1j4t7m-01hd-2n0g-64he-8glkug6wxe",
      "cu465xer-tak5-2jx1-iwcw-i9uxmmmznrf"
    ],
    "cohortIds": [
      "mou5fils-3jju-9clt-fyxk-oqo6fwpmvk",
      "jfvavn4o-gn0t-4s98-lt1x-tv5io17xvjb"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "1y40j0t0-81m1-h0tg-ickf-jtznr3o66ll",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "lzwi2gcx-dbwd-wydo-v6l3-gqaoi6zsf78",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "completedAt": "2025-07-21T03:02:37.893Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "oxrskgzh-ywsc-471k-0vos-v2tl62v2zaa",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "updatedAt": "2025-07-21T03:02:37.893Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "siv8kq0p-sykd-v7po-cvtj-r4kpjjmckti",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "passed": false,
    "score": 59,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "u7bt6rnc-4tae-wye8-xyla-n5gtup3s3q",
    "createdAt": "2025-07-21T03:02:37.893Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 88,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-21T03:02:37.893Z",
    "token": "token_1"
  }
];

