import React from 'react';
import {
  LandingPageGetServerSideProps as getServerSideProps,
  NavPageLayout,
} from '@gen3/frontend';
import type { HeaderProps } from '@gen3/frontend';
import DataSummary from '@/components/DataSummary';

interface Props {
  headerProps: HeaderProps;
  footerProps: React.ComponentProps<typeof NavPageLayout>['footerProps'];
  landingPage?: {
    headerMetadata?: {
      title?: string;
      content?: string;
      key?: string;
    };
  };
}

const Home = ({ headerProps, footerProps, landingPage }: Props) => {
  return (
    <NavPageLayout
      headerProps={headerProps}
      footerProps={footerProps}
      headerMetadata={{
        title: 'BCCA Data Platform',
        content: 'Home page',
        key: 'bcca-home-page',
        ...(landingPage?.headerMetadata ?? {}),
      }}
    >
      <div className="w-full max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-primary mb-4">
          BCCA Data Platform
        </h1>
        <p className="text-base text-base-darkest mb-4">
          The <strong>BCCA Data Platform</strong> is a single web interface
          which allows visitors to <strong>discover, access and analyze data</strong>.
          Making data easily findable enables secondary, cross-study analyses,
          promotes dissemination of research and accelerates new discoveries.
        </p>
        <a
          href="/Explorer"
          className="inline-block bg-primary text-primary-contrast font-semibold px-4 py-2 rounded hover:bg-primary-dark transition-colors"
        >
          Explore BCCA Data
        </a>
        <p className="text-base text-base-darkest mt-6">
          The Gen3 platform consists of open-source software services that
          support the emergence of healthy data ecosystems by enabling the
          interoperation and creation of cloud-based data resources, including
          data commons and analysis workspaces.
        </p>
        <a
          href="https://gen3.org/"
          className="inline-block mt-2 text-primary underline hover:text-primary-dark"
        >
          Learn More
        </a>
      </div>

      <DataSummary />

      <div className="w-full max-w-6xl mx-auto px-6 py-8">
        <blockquote className="border-l-4 border-primary pl-4 italic text-lg text-base-darkest">
          Our vision is a world in which researchers have ready access to the
          data needed and the tools required to make data-driven discoveries
          that increase our scientific knowledge and improve the quality of life.
        </blockquote>
      </div>
    </NavPageLayout>
  );
};

export default Home;
export { getServerSideProps };
