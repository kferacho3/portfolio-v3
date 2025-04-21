// components/SectionTwoData.tsx

export interface Project {
  id: number;
  title: string;
  imageDesktop: string;
  imageMobile: string;
  link: string;
  description: string;
  techStack: string[];
  frameworks: string[];
}

export const featuredWebsites: Project[] = [
  {
    id: 1,
    title: 'Web³ Outfitters',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/web3outfittersFinal.png',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/web3outfittersFinal.png',
    link: 'https://www.web3outfitters.io/',
    description:
      'A pioneering web³ site that employs immersive technology to enhance user interaction and scalability. This platform supports NFTs, digital wearables, and more, utilizing a sophisticated mix of React Three Fiber, styled-components, framer motion, and react-spring.',
    techStack: ['JavaScript', 'React', 'Three.js'],
    frameworks: ['React Three Fiber', 'Framer Motion', 'Styled Components'],
  },
  {
    id: 2,
    title: 'Sunny Island Pepper Sauce',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/SunnyIslandPepper.png',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/SunnyIslandPepper.png',
    link: 'https://www.sunnyislandpeppersauce.com/',
    description:
      'A unique and specialized 3D ecommerce platform designed for an emerging food product. It incorporates technologies such as React Three Fiber, styled-components, framer motion, and react-spring.',
    techStack: ['JavaScript', 'React', 'Three.js'],
    frameworks: ['React Three Fiber', 'Framer Motion', 'Styled Components'],
  },
  {
    id: 3,
    title: 'Antiheroes',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/BlackHatFinal.png',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/BlackHatFinal.png',
    link: 'https://ferachobrand.com',
    description:
      'A professional networking platform tailored for minorities, reminiscent of LinkedIn but with customized features. The site includes multiple pages and layouts, catering to various profile types.',
    techStack: ['JavaScript', 'React', 'Node.js'],
    frameworks: ['Express', 'MongoDB', 'Styled Components'],
  },
];

export const incompleteProjects: Project[] = [
  {
    id: 4,
    title: 'MetaTunes',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/MetaTunesFinal.png',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/MetaTunesFinal.png',
    link: 'https://metatunes.com/',
    description:
      'An early project for a now-defunct NFT platform using React and styled-components for a seamless digital experience.',
    techStack: ['JavaScript', 'React'],
    frameworks: ['Styled Components', 'P5.js'],
  },
  {
    id: 5,
    title: 'K & M Renovation and Restoration',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/KandMFinal.png',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/KandMFinal.png',
    link: 'https://kandmrenovation.com',
    description:
      'A two-page site for an independent roofing contractor, deployed using Firebase cloud services.',
    techStack: ['JavaScript', 'HTML', 'CSS'],
    frameworks: ['Firebase'],
  },
  {
    id: 6,
    title: 'Get Relocate',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/RelocateFinal.png',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/RelocateFinal.png',
    link: 'https://main.d1kac4geol6jy1.amplifyapp.com',
    description:
      'A comprehensive site for a moving company startup, with advanced technology integration aimed at enhancing operational efficiency.',
    techStack: ['JavaScript', 'React'],
    frameworks: ['AWS Amplify', 'Styled Components'],
  },
];

export const uiUxDesigns: Project[] = [
  {
    id: 7,
    title: 'st Home Rental',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/stHomeRentalFinal.png',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/ClientDesigns-PublishedWebsites/stHomeRentalFinal.png',
    link: 'https://sthomerental.com',
    description:
      'Digital gateway for a hospitality service, providing a comprehensive and welcoming experience for users seeking accommodation.',
    techStack: ['JavaScript', 'React'],
    frameworks: ['Styled Components'],
  },
  {
    id: 8,
    title: 'Black C.A.T.',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/uiuxdesigns/blackcat.png',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/uiuxdesigns/blackcat.png',
    link: '#',
    description:
      'A platform similar to LinkedIn for connecting with other individuals, catered specifically to minorities.',
    techStack: ['JavaScript', 'React'],
    frameworks: ['Styled Components'],
  },
  {
    id: 9,
    title: 'Show No Love Apparel',
    imageDesktop:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/uiuxdesigns/shownolove.png',
    imageMobile:
      'https://racho-devs.s3.us-east-2.amazonaws.com/myProjects/uiuxdesigns/shownolove.png',
    link: '#',
    description:
      'Upcoming e-commerce website for a clothing brand based in Atlanta.',
    techStack: ['JavaScript', 'React'],
    frameworks: ['Styled Components'],
  },
];
