#! /bin/python3
import rclpy
from rclpy.node import Node

# from bluepy.btle import Scanner, DefaultDelegate
from std_msgs.msg import Int8MultiArray
from rclpy.qos import qos_profile_sensor_data


class MAIN(Node):

    def __init__(self):
        super().__init__("gui_converter")
        self.result = False
        self.declare_parameter("rid", 1)
        rid = str(self.get_parameter("rid").get_parameter_value().integer_value)

        self.sub = self.create_subscription(
            Int8MultiArray,
            "/Robot" + rid + "/console2converter",
            self.bos_console_callback,
            qos_profile_sensor_data,
        )
        self.pub = self.robot.create_publisher(
            Int8MultiArray,
            "/Robot" + rid + "/console2robot",
            qos_profile_sensor_data,
        )

    def bos_console_callback(self, msg):
        # for qos setting
        self.get_logger().info(f"Message: {msg}")
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    controller = MAIN()

    rclpy.spin(controller)

    controller.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
