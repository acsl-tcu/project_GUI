"use client"
import Image from "next/image";
import React, { useState } from 'react';
import CameraData from '../components/CameraData';
import RosCmd from '../components/CMD';
import Rosconnection from '../components/RosConnection';
//import 'bootstrap/dist/css/bootstrap.min.css';
import { Row, Col, ToggleButton, ToggleButtonGroup, Button } from 'react-bootstrap';

function ToggleButtonGroupControlled() {
  const [value, setValue] = useState([1, 3]);

  /*
   * The second argument that will be passed to
   * `handleChange` from `ToggleButtonGroup`
   * is the SyntheticEvent object, but we are
   * not using it in this example so we will omit it.
   */
  const handleChange = (val) => setValue(val);

  return (
    <ToggleButtonGroup type="radio" name="options" defaultValue={value} value={value} onChange={handleChange}>
      <ToggleButton id="tbg-btn-1" value={1}>
        Option 1
      </ToggleButton>
      <ToggleButton id="tbg-btn-2" value={2}>
        Option 2
      </ToggleButton>
      <ToggleButton id="tbg-btn-3" value={3}>
        Option 3
      </ToggleButton>
      <div className="d-grid gap-2">
        <Button variant="primary" size="lg">
          Block level button
        </Button>
        <Button variant="secondary" size="lg">
          Block level button
        </Button>
      </div>
    </ToggleButtonGroup>
  );
}


export default function Home() {
  const [ros, setRos] = useState(null);
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <ToggleButtonGroupControlled />
        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <Rosconnection rosUrl="ws://localhost:9090" rosDomainId={66} setRos={setRos} />
          <h1>ROS Control Panel</h1>           {ros &&
            <>
              (<RosCmd ros={ros} />)
              <Row>
                <Col>
                  <div className="d-flex justify-content-center align-items-center">
                    <CameraData ros={ros} />
                  </div>
                </Col>
              </Row>
            </>
          }

          <hr />
          <h3>Connection: <span id="status">N/A</span></h3>
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
