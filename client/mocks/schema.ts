// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 12,
    "userId": 31,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 99,
    "idToken": "idToken_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 58,
    "userId": 10,
    "expires": "2025-07-20T11:17:16.190Z",
    "sessionToken": "sessionToken_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 66,
    "name": "Admin User",
    "emailVerified": "2025-07-20T11:17:16.190Z"
  },
  {
    "id": 87,
    "name": "Instructional User",
    "emailVerified": "2025-07-20T11:17:16.190Z",
    "image": "image_2"
  },
  {
    "id": 50,
    "email": "instructor@example.com",
    "emailVerified": "2025-07-20T11:17:16.190Z",
    "image": "image_3"
  },
  {
    "id": 37,
    "name": "TA User",
    "email": "ta@example.com",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "v6h18u07-4gzy-8mlh-pf72-lbg1tjtcom",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "userId": 66,
    "lastLogin": "2025-07-20T11:17:16.190Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "role": "admin",
    "active": true,
    "lastActive": "2025-07-20T11:17:16.190Z"
  },
  {
    "id": "dn4im37c-q41g-q3pd-imel-0nfqpc0ap2q",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "userId": 87,
    "lastLogin": "2025-07-20T11:17:16.190Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "role": "instructional",
    "active": false,
    "lastActive": "2025-07-20T11:17:16.190Z"
  },
  {
    "id": "qd5mg51o-8lzy-p55y-i119-7k9gs32fwbm",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "userId": 50,
    "lastLogin": "2025-07-20T11:17:16.190Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "role": "instructor",
    "active": false,
    "lastActive": "2025-07-20T11:17:16.190Z"
  },
  {
    "id": "jwm6vbc8-xinh-fm64-61ed-ocyfur7avxt",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "userId": 37,
    "lastLogin": "2025-07-20T11:17:16.190Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "role": "ta",
    "active": false,
    "lastActive": "2025-07-20T11:17:16.190Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "ypti4vv1-urff-jnoz-jetv-f5cju1v7bg6",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// DEPARTMENTS MOCK DATA
export const departments = [
  {
    "id": "oxyf5gg1-qfnm-o28c-gtqq-7dn5a2ie3vp",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "departmentCode": "departmentCode_1",
    "name": "Departments 1",
    "description": "Description for departments 1",
    "profileIds": [
      "v6h18u07-4gzy-8mlh-pf72-lbg1tjtcom",
      "dn4im37c-q41g-q3pd-imel-0nfqpc0ap2q",
      "qd5mg51o-8lzy-p55y-i119-7k9gs32fwbm",
      "jwm6vbc8-xinh-fm64-61ed-ocyfur7avxt"
    ]
  }
];

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "hubhjkwd-28u5-dlo2-4if7-0g548xs0qv2",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "departmentId": "departmentId_1",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1",
    "profileIds": [
      "v6h18u07-4gzy-8mlh-pf72-lbg1tjtcom",
      "dn4im37c-q41g-q3pd-imel-0nfqpc0ap2q",
      "qd5mg51o-8lzy-p55y-i119-7k9gs32fwbm",
      "jwm6vbc8-xinh-fm64-61ed-ocyfur7avxt"
    ]
  },
  {
    "id": "01k0whmk-lzxu-yrr2-vtae-0z5esmx5fieh",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "departmentId": "departmentId_2",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2",
    "profileIds": [
      "v6h18u07-4gzy-8mlh-pf72-lbg1tjtcom",
      "dn4im37c-q41g-q3pd-imel-0nfqpc0ap2q",
      "qd5mg51o-8lzy-p55y-i119-7k9gs32fwbm",
      "jwm6vbc8-xinh-fm64-61ed-ocyfur7avxt"
    ]
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "udt9pdr7-sgjn-3un6-ys2y-3h6tzfyo0z5",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// LOCATIONS MOCK DATA
export const locations = [
  {
    "id": "rnmhrlv2-i9j2-tid5-tjr5-nsn0wopo9yg",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "name": "Locations 1",
    "description": "Description for locations 1",
    "departmentId": "departmentId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "2ywac908-bdnc-9qt2-tihn-gtx0nwdlb2o",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
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
    "id": "by18wdp2-uqx7-m3bh-tn3g-gz0cz28cyyk",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 69,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "u3h1jml7-cn6l-0zri-bou6-mle1jo8gsw",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 65,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "ln2aavds-ebo6-9apu-mo9y-s1qyen94no",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 10,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "dggq984v-plb3-ny3a-eyq2-yjemyqaa59",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 72,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 68,
    "level": "level_1",
    "message": "message_1",
    "createdAt": "2025-07-20T11:17:16.190Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 45,
    "createdAt": "2025-07-20T11:17:16.190Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "euwfukiq-cuor-h08m-to6y-iazajsnj3wo",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "yv0ust0y-21ou-yjp7-eqfp-fgux5x4jtzf",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "completedAt": "2025-07-20T11:17:16.190Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "f3l9cepl-b8tf-xe0m-kohd-0sf3mzdzogs8",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "completedAt": "2025-07-20T11:17:16.190Z",
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
    "id": "qs2q2853-mxfm-lww0-hmg8-qu5fx3uu35",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
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
    "id": "un5x0a79-9kf7-5cju-f1hf-fryp20y0ono",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "profileId": "profileId_1",
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
    "id": "qr1q6efb-is2l-yt69-tjl9-33plbxbxcgc",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.75,
    "defaultAgent": "defaultAgent_1",
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "tsh88euc-7vzt-jqc2-og05-h8pfrx8xe3",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.18,
    "defaultAgent": "defaultAgent_2",
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "edgnby23-pzqc-c4q0-jts3-vuojzc9xis9",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.37,
    "modelId": "modelId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "5saalas3-5opq-4a4l-wk97-minx1hln9wn",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "intensity": 82,
    "locationId": "locationId_1",
    "deadlineId": "deadlineId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": false,
    "parentId": "parentId_1"
  },
  {
    "id": "5qs538mg-f2wv-xf63-krwd-5gxm4sjxnqo",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "crowdedness": 92,
    "intensity": 98,
    "locationId": "locationId_2",
    "deadlineId": "deadlineId_2",
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "parentId": "parentId_2"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "pbat99ld-m1od-b4wl-77e3-jmanemai3s",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "kxxshknf-a19n-3x87-49jj-6paexk9sf4h",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "e87ozer0-xcwr-bo0v-e1yn-jxlihad42up",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "v6h18u07-4gzy-8mlh-pf72-lbg1tjtcom",
      "dn4im37c-q41g-q3pd-imel-0nfqpc0ap2q",
      "qd5mg51o-8lzy-p55y-i119-7k9gs32fwbm",
      "jwm6vbc8-xinh-fm64-61ed-ocyfur7avxt"
    ],
    "defaultCohort": "defaultCohort_1",
    "departmentId": "departmentId_1"
  },
  {
    "id": "hrenclbw-dlof-hoc6-0mc2-9m5a7xxt27c",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "v6h18u07-4gzy-8mlh-pf72-lbg1tjtcom",
      "dn4im37c-q41g-q3pd-imel-0nfqpc0ap2q",
      "qd5mg51o-8lzy-p55y-i119-7k9gs32fwbm",
      "jwm6vbc8-xinh-fm64-61ed-ocyfur7avxt"
    ],
    "defaultCohort": "defaultCohort_2",
    "departmentId": "departmentId_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "eh6xmqc1-n6ej-tvdo-aa3l-lzgcahw0an",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "5saalas3-5opq-4a4l-wk97-minx1hln9wn",
      "5qs538mg-f2wv-xf63-krwd-5gxm4sjxnqo"
    ],
    "cohortIds": [
      "e87ozer0-xcwr-bo0v-e1yn-jxlihad42up",
      "hrenclbw-dlof-hoc6-0mc2-9m5a7xxt27c"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "5o3ybr94-207l-9mwx-6bl9-ubq55njigc",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "5saalas3-5opq-4a4l-wk97-minx1hln9wn",
      "5qs538mg-f2wv-xf63-krwd-5gxm4sjxnqo"
    ],
    "cohortIds": [
      "e87ozer0-xcwr-bo0v-e1yn-jxlihad42up",
      "hrenclbw-dlof-hoc6-0mc2-9m5a7xxt27c"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "nt348574-osbp-3hvx-0l5s-4235jgixh48",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "s2cy85nf-6ipy-1qwd-63g6-qubkmb536i",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "completedAt": "2025-07-20T11:17:16.190Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true,
    "traceId": "traceId_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "ssrov8o8-ek22-77c4-hhw8-e8bdhzwfyuq",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "updatedAt": "2025-07-20T11:17:16.190Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "491w70ru-s9h4-9ett-g2lg-xzpf9z0w4e",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "passed": false,
    "score": 86,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "dp7b8xsz-nto3-bzg2-ypei-3vper7uejvb",
    "createdAt": "2025-07-20T11:17:16.190Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 12,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-20T11:17:16.190Z",
    "token": "token_1"
  }
];

