// api/query.js
export default async function handler(req, res) {
  // 设置 CORS 头部，允许你的前端页面跨域访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productName } = req.body;
  if (!productName || productName.trim() === '') {
    return res.status(400).json({ error: '产品名称不能为空' });
  }

  // 从环境变量获取 API Key
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务器未配置 API Key' });
  }

  // 构造提示词，要求 AI 返回结构化信息
  const prompt = `请帮我查询“${productName}”这款产品的详细信息，包括：
1. 生产厂家全称
2. 是否具备进出口资质（根据公开信息判断）
3. 功能属性：是保健功能还是治病功能（药品/医疗器械）
4. 补充说明（批准文号、使用注意事项等）
请用简洁的中文回答，每项一行，格式如下：
厂家：xxx
进出口资质：xxx
功能属性：xxx
补充：xxx`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的产品信息查询助手，可以联网搜索最新公开数据。回答时请严格遵循用户要求的格式。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        // 开启联网搜索（需要 DeepSeek 账号支持联网功能）
        enable_search: true
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'API 调用失败');
    }

    const aiReply = data.choices[0].message.content;
    // 解析 AI 返回的文本，提取四项信息
    const lines = aiReply.split('\n');
    let result = {
      manufacturer: '未获取到',
      importExport: '未获取到',
      functionType: '未获取到',
      additional: '未获取到'
    };
    for (const line of lines) {
      if (line.includes('厂家：')) result.manufacturer = line.split('厂家：')[1].trim();
      else if (line.includes('进出口资质：')) result.importExport = line.split('进出口资质：')[1].trim();
      else if (line.includes('功能属性：')) result.functionType = line.split('功能属性：')[1].trim();
      else if (line.includes('补充：')) result.additional = line.split('补充：')[1].trim();
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}