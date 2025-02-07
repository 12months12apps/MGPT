import { FaTwitter, FaGithub } from "react-icons/fa";
import { SiZhihu, SiBilibili } from "react-icons/si";

const SocialLinks = () => {
  const links = [
    { icon: <FaTwitter />, link: "https://x.com/wfnuser" },
    { icon: <FaGithub />, link: "https://github.com/wfnuser" },
    { icon: <SiZhihu />, link: "https://www.zhihu.com/people/qin-hao-37" },
    { icon: <SiBilibili />, link: "https://space.bilibili.com/3553667" },
  ];

  return (
    <div className="flex items-center gap-4">
      {links.map((item, index) => (
        <a
          key={index}
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="text-gray-600 hover:text-cyan-500 transition-colors"
        >
          <div className="w-5 h-5">{item.icon}</div>
        </a>
      ))}
    </div>
  );
};

export default SocialLinks;
