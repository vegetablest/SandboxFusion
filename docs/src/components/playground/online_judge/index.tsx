import React, { useState } from "react";

import {
  Button,
  Divider,
  Grid,
  Select,
  SelectProps,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from "@arco-design/web-react";
import { useRequest } from "ahooks";
import { Editor as MonacoEditor } from "@monaco-editor/react";
import SmartCodeEditor from "../components/SmartCodeEditor";
import { marked } from "marked";
import { RenderType } from "../types";

import { onlineJudgeService } from "../service";
import codeCss from "../style/index.module.css";
import css from "./index.module.css";
import CodeRunResult from "../components/CodeRunResult";
import {
  SELECT_SEARCH_PROPS,
  SELECT_TRIGGER_PROPS,
  sandboxLanguageList,
} from "../constants";
import { getFormatJson } from "../utils";

const { Row, Col } = Grid;

enum QuestionMode {
  lib = "lib",
  custom = "custom",
}

function getSelectOptionsByStringList(
  strList?: string[]
): SelectProps["options"] {
  return strList?.map((str) => ({
    label: str.toString(),
    value: str,
  }));
}

const OnlineJudge: React.FC = () => {
  const [questionMode, setQuestionMode] = useState(QuestionMode.lib);
  const [dataset, setDataset] = useState<string>();
  const [id, setId] = useState<string>();
  const [config, setConfig] = useState<string>(
    getFormatJson({
      language: "python",
      is_fewshot: false,
    }) as string
  );
  const [customConfig, setCustomConfig] = useState(
    getFormatJson({
      language: "python",
      is_fewshot: false,
    }) as string
  );
  const [renderType, setRenderType] = useState(RenderType.MARKDOWN);
  // 答案
  const [completion, setCompletion] = useState<string>("");
  const [resCodeTab, setResCodeTab] = useState("entire");
  const [resTestTab, setResTestTab] = useState("0");

  const getConfigJson = (configStr = config) => {
    try {
      return JSON.parse(configStr);
    } catch (e) {
      return {};
    }
  };

  const {
    data: datasets,
    loading: listDatasetsLoading,
    run: listDatasets,
  } = useRequest(onlineJudgeService.listDatasets, { manual: false });

  // 获取题号
  const {
    data: questionIdList,
    loading: questionIdListLoading,
    run: getQuestionIdList,
  } = useRequest(
    () => {
      return onlineJudgeService.getQuestionIdList({
        dataset,
        offset: 0,
        limit: 100000,
        config: getConfigJson(),
      });
    },
    { ready: Boolean(dataset), manual: false, refreshDeps: [dataset] }
  );

  // 获取Prompt
  const {
    data: promptRes,
    loading: getPromptResLoading,
    run: getPromptRes,
  } = useRequest(
    () => {
      return onlineJudgeService.getPromptById({
        config: getConfigJson(),
        dataset,
        id,
      });
    },
    {
      ready: Boolean(dataset) && Boolean(id),
      manual: false,
      refreshDeps: [dataset, id],
    }
  );

  const {
    data: submitRes,
    run: onSubmit,
    loading: submitLoading,
  } = useRequest(
    () => {
      if (questionMode === QuestionMode.custom) {
        return onlineJudgeService.submit(getConfigJson(customConfig));
      }
      return onlineJudgeService.submit({
        dataset,
        config: getConfigJson(),
        completion,
        id,
      });
    },
    { manual: true }
  );

  const questionHeader = (
    <Row>
      <Col flex={1}>
        <Space direction="vertical">
          {/* <Space>
              <Radio.Group value={questionMode} onChange={setQuestionMode} type="button">
                <Radio value={QuestionMode.lib}>{`题库选题`}</Radio>
                <Radio value={QuestionMode.custom}>{`自定义`}</Radio>
              </Radio.Group>
            </Space> */}
          {[QuestionMode.lib].includes(questionMode) && (
            <Space>
              <Select
                style={{ width: 190 }}
                prefix={`题库`}
                value={dataset}
                onChange={setDataset}
                options={getSelectOptionsByStringList(datasets)}
                loading={listDatasetsLoading}
                allowCreate
                {...SELECT_SEARCH_PROPS}
                triggerProps={SELECT_TRIGGER_PROPS}
              />
              <Select
                allowCreate
                style={{ width: 190 }}
                prefix={`题号`}
                disabled={!dataset}
                placeholder={dataset ? `请选择` : `请先选择题库`}
                value={id}
                onChange={setId}
                options={getSelectOptionsByStringList(questionIdList)}
                loading={questionIdListLoading}
                {...SELECT_SEARCH_PROPS}
                triggerProps={SELECT_TRIGGER_PROPS}
              />
            </Space>
          )}
        </Space>
      </Col>
      <Col flex="none">
        <Button type="primary" loading={submitLoading} onClick={onSubmit}>
          Submit
        </Button>
      </Col>
    </Row>
  );

  const questionContent = (
    <>
      <Row style={{ paddingTop: 8 }}>
        <Col flex={1}>
          <Space>
            <div className={codeCss.partTitle} />
            <Typography.Title heading={6} style={{ margin: 0 }}>
              Prompt
            </Typography.Title>
          </Space>
        </Col>
        <Col flex="none">
          <Tabs
            type="text"
            activeTab={renderType}
            onChange={(val) => setRenderType(val as RenderType)}
          >
            <Tabs.TabPane key={RenderType.MARKDOWN} title="Markdown" />
            <Tabs.TabPane key={RenderType.PLAINTEXT} title={`普通文本`} />
          </Tabs>
        </Col>
      </Row>
      {!promptRes?.prompt || renderType === RenderType.PLAINTEXT ? (
        <pre className={css.pre}>{promptRes?.prompt}</pre>
      ) : (
        <div style={{ minHeight: 200 }}>
          {promptRes?.prompt && (
            <div
              dangerouslySetInnerHTML={{
                __html: marked.parse(promptRes?.prompt) as string,
              }}
            />
          )}
        </div>
      )}
      <Space style={{ paddingTop: 8 }}>
        <div className={codeCss.partTitle} />
        <Typography.Title heading={6} style={{ margin: 0 }}>
          Answer
        </Typography.Title>
      </Space>
      <MonacoEditor
        height={200}
        value={completion}
        onChange={(val) => setCompletion(val as string)}
      />
      <Space style={{ paddingTop: 8 }}>
        <div className={codeCss.partTitle} />
        <Typography.Title
          heading={6}
          style={{ margin: 0 }}
        >{`配置`}</Typography.Title>
      </Space>
      <MonacoEditor
        height={200}
        value={config}
        onChange={(val) => setConfig(val as string)}
        language="json"
      />
    </>
  );

  const resultPart = (
    <Space style={{ display: "flex" }} direction="vertical">
      {submitRes && (
        <Tag color={submitRes?.accepted ? "green" : "red"}>
          {submitRes?.accepted ? "Accepted" : "Rejected"}
        </Tag>
      )}
      <Tabs type="text" activeTab={resCodeTab} onChange={setResCodeTab}>
        <Tabs.TabPane key={"extract"} title={`抽取代码`} />
        <Tabs.TabPane key={"entire"} title={`完整代码`} />
        <Tabs.TabPane key={"judge"} title={`测试代码`} />
      </Tabs>
      <SmartCodeEditor
        language="python"
        languageSelectEnabled
        allowLanguageList={sandboxLanguageList}
        height={240}
        readOnly
        toolbarNoLabel
        value={
          {
            extract: submitRes?.extracted_code || "",
            entire: submitRes?.full_code || "",
            judge: submitRes?.test_code || "",
          }[resCodeTab]
        }
      />
      <Space>
        <div className={codeCss.partTitle} />
        <Typography.Title
          heading={6}
          style={{ margin: 0 }}
        >{`单例测试`}</Typography.Title>
      </Space>
      <Tabs
        type="text"
        activeTab={resTestTab}
        onChange={setResTestTab}
        direction="vertical"
      >
        {submitRes?.tests?.map((item, index) => {
          return (
            <Tabs.TabPane
              key={`${index}`}
              title={
                <Space>
                  {index + 1}
                  <Tag color={item.passed ? "green" : "red"}>
                    {item.passed ? "Passed" : "Aborted"}
                  </Tag>
                </Space>
              }
            >
              <CodeRunResult data={item.exec_info} />
            </Tabs.TabPane>
          );
        })}
      </Tabs>
    </Space>
  );

  return (
    <Row style={{ minWidth: 1200, height: "100%" }}>
      <Col flex="520px" className={codeCss.sideWrap}>
        {questionHeader}
        {questionContent}
      </Col>
      <Col flex="none" className={codeCss.sideWrap}>
        <Divider type="vertical" style={{ height: "100%" }} />
      </Col>
      <Col flex={1} style={{ minWidth: 0 }} className={codeCss.sideWrap}>
        <Spin block loading={submitLoading}>
          {resultPart}
        </Spin>
      </Col>
    </Row>
  );
};

OnlineJudge.displayName = "OnlineJudge";

export default React.memo(OnlineJudge);
